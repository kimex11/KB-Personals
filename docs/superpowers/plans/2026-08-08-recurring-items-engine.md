# Recurring Items Engine (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bills and reminders can be marked Recurring (daily/weekly/biweekly/monthly/quarterly/semi-annual/annual/custom-N-days-or-weeks-or-months), automatically generate their next occurrence as a new row when paid/completed or explicitly skipped, and support pause/resume/stop on the series — with full, queryable history and timezone/month-end-safe date math.

**Architecture:** A new `recurring_series` table holds the recurrence rule. Each cycle is its own row in `bills`/`reminders` (never mutated once closed) linked via `series_id`/`cycle_number`. Closing a cycle (pay/complete/skip) triggers a pure `computeNextOccurrence` function that decides whether and when to generate the next row; a repository-layer orchestration function performs the actual close + insert + series-counter update as one flow.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres), `date-fns` (`addDays`/`addWeeks`/`addMonths` — already a project dependency), vitest + Testing Library.

## Global Constraints

- Every generated cycle is a **new row**, not a mutated one — closed rows are permanent history, queryable as `select * from bills where series_id = $1 order by cycle_number`.
- Date math operates on ISO date strings (`yyyy-MM-dd`) only, no time-of-day — `bills.due_date`/`reminders.due_date` are DATE columns with no time component, so there is nothing for a timezone to get wrong as long as every conversion stays local-time end to end (see Task 3).
- `date-fns`'s `addMonths` clamps day-of-month overflow to the target month's last valid day — this is the mechanism that makes Jan 31 + 1 month land on Feb 28/29 correctly. Do not hand-roll month arithmetic.
- Out of scope for this phase (explicitly deferred to Phase 2/3 per the design spec): any countdown badge/progress ring/urgency color, filters, summary tiles, and editing an *existing* recurring series' rule (frequency/amount-mode/end-conditions) from the UI — `updateSeriesStatus` exists at the repository layer (pause/resume/stop) but no settings panel is wired to it yet in this phase.
- This app's tables are global/shared, not per-user (RLS gates on `authenticated`, not row ownership — see migrations 0004/0006/0007). `recurring_series` follows the same convention.
- Supabase project `qxkgjxxuoxczyuvhcbal` is not reachable via this session's Supabase MCP/CLI access — migration application is a manual step for the user (same as migrations `0009`/`0010`).
- Follow existing repository conventions: manual row interfaces + `as RowType` casts (no generated `Database` types in this repo), `lib/supabase/client.ts`'s `createClient()`.

---

### Task 1: `recurring_series` table + bills/reminders columns migration

**Files:**
- Create: `supabase/migrations/0011_recurring_series.sql`

**Interfaces:**
- Produces: table `public.recurring_series`; new columns `series_id`, `cycle_number`, `skipped` on `public.bills` and `public.reminders`. Consumed by every later task.

- [ ] **Step 1: Write the migration**

```sql
-- Recurring items engine: recurring_series holds the recurrence rule.
-- Each generated cycle is its own row in bills/reminders (never mutated
-- once closed) -- history is just "all rows sharing a series_id", so no
-- separate append-only log table is needed.

create table public.recurring_series (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('bill', 'reminder')),
  frequency text not null check (frequency in
    ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semi_annual', 'annual', 'custom')),
  custom_interval_unit text check (custom_interval_unit in ('day', 'week', 'month')),
  custom_interval_count integer check (custom_interval_count > 0),
  amount_mode text not null default 'fixed' check (amount_mode in ('fixed', 'editable')),
  auto_renew boolean not null default true,
  end_date date,
  max_occurrences integer check (max_occurrences > 0),
  occurrences_generated integer not null default 1,
  status text not null default 'active' check (status in ('active', 'paused', 'stopped')),
  created_at timestamptz not null default now(),
  check (
    (frequency = 'custom' and custom_interval_unit is not null and custom_interval_count is not null)
    or (frequency != 'custom' and custom_interval_unit is null and custom_interval_count is null)
  )
);

alter table public.recurring_series enable row level security;

create policy "Authenticated users can view recurring series"
  on public.recurring_series for select to authenticated using (true);
create policy "Authenticated users can insert recurring series"
  on public.recurring_series for insert to authenticated with check (true);
create policy "Authenticated users can update recurring series"
  on public.recurring_series for update to authenticated using (true);

alter table public.bills
  add column series_id uuid references public.recurring_series(id) on delete set null,
  add column cycle_number integer,
  add column skipped boolean not null default false;

alter table public.reminders
  add column series_id uuid references public.recurring_series(id) on delete set null,
  add column cycle_number integer,
  add column skipped boolean not null default false;

create unique index bills_series_cycle_unique_idx on public.bills(series_id, cycle_number) where series_id is not null;
create unique index reminders_series_cycle_unique_idx on public.reminders(series_id, cycle_number) where series_id is not null;
```

- [ ] **Step 2: Apply the migration**

Requires the Supabase CLI linked to this project (not reachable in this session):

```bash
supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0011_recurring_series.sql
git commit -m "feat: add recurring_series table and bills/reminders cycle columns"
```

---

### Task 2: Recurring types + date math

**Files:**
- Create: `lib/recurring-types.ts`
- Create: `lib/recurring-date-math.ts`
- Test: `lib/recurring-date-math.test.ts`

**Interfaces:**
- Produces: `Frequency`, `CustomIntervalUnit`, `AmountMode`, `SeriesStatus`, `EntityType` types; `RecurringSeries`, `CreateSeriesInput` interfaces (`lib/recurring-types.ts`); `addInterval(dueDate: string, frequency: Frequency, customIntervalUnit?: CustomIntervalUnit | null, customIntervalCount?: number | null): string` (`lib/recurring-date-math.ts`). Consumed by Task 3 (`recurring-generation.ts`), Task 5 (`recurring-series-repository.ts`), and every later task that touches series.

- [ ] **Step 1: Write the types file (no test — pure type declarations)**

```typescript
// lib/recurring-types.ts
export type Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'custom';
export type CustomIntervalUnit = 'day' | 'week' | 'month';
export type AmountMode = 'fixed' | 'editable';
export type SeriesStatus = 'active' | 'paused' | 'stopped';
export type EntityType = 'bill' | 'reminder';

export interface RecurringSeries {
  id: string;
  entityType: EntityType;
  frequency: Frequency;
  customIntervalUnit: CustomIntervalUnit | null;
  customIntervalCount: number | null;
  amountMode: AmountMode;
  autoRenew: boolean;
  endDate: string | null;
  maxOccurrences: number | null;
  occurrencesGenerated: number;
  status: SeriesStatus;
}

export interface CreateSeriesInput {
  entityType: EntityType;
  frequency: Frequency;
  customIntervalUnit?: CustomIntervalUnit;
  customIntervalCount?: number;
  amountMode?: AmountMode;
  autoRenew?: boolean;
  endDate?: string | null;
  maxOccurrences?: number | null;
}
```

- [ ] **Step 2: Write the failing test for date math**

```typescript
// lib/recurring-date-math.test.ts
import { describe, expect, it } from 'vitest';
import { addInterval } from './recurring-date-math';

describe('addInterval', () => {
  it('adds 1 day for daily', () => {
    expect(addInterval('2026-08-01', 'daily')).toBe('2026-08-02');
  });

  it('adds 7 days for weekly', () => {
    expect(addInterval('2026-08-01', 'weekly')).toBe('2026-08-08');
  });

  it('adds 14 days for biweekly', () => {
    expect(addInterval('2026-08-01', 'biweekly')).toBe('2026-08-15');
  });

  it('adds 1 month for monthly, clamping month-end overflow (non-leap February)', () => {
    expect(addInterval('2026-01-31', 'monthly')).toBe('2026-02-28');
  });

  it('adds 1 month for monthly, clamping into a leap-year February', () => {
    expect(addInterval('2028-01-31', 'monthly')).toBe('2028-02-29');
  });

  it('adds 3 months for quarterly, clamping into a 30-day month', () => {
    expect(addInterval('2026-01-31', 'quarterly')).toBe('2026-04-30');
  });

  it('adds 6 months for semi_annual', () => {
    expect(addInterval('2026-08-01', 'semi_annual')).toBe('2027-02-01');
  });

  it('adds 12 months for annual', () => {
    expect(addInterval('2026-08-01', 'annual')).toBe('2027-08-01');
  });

  it('adds N days for custom day interval', () => {
    expect(addInterval('2026-08-01', 'custom', 'day', 10)).toBe('2026-08-11');
  });

  it('adds N weeks for custom week interval', () => {
    expect(addInterval('2026-08-01', 'custom', 'week', 6)).toBe('2026-09-12');
  });

  it('adds N months for custom month interval, clamping month-end overflow', () => {
    expect(addInterval('2026-01-31', 'custom', 'month', 2)).toBe('2026-03-31');
  });

  it('throws when custom frequency is missing unit/count', () => {
    expect(() => addInterval('2026-08-01', 'custom')).toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/recurring-date-math.test.ts`
Expected: FAIL with "Cannot find module './recurring-date-math'"

- [ ] **Step 4: Write the implementation**

```typescript
// lib/recurring-date-math.ts
import { addDays, addWeeks, addMonths } from 'date-fns';
import { toISODateString } from './date-utils';
import type { Frequency, CustomIntervalUnit } from './recurring-types';

export function addInterval(
  dueDate: string,
  frequency: Frequency,
  customIntervalUnit?: CustomIntervalUnit | null,
  customIntervalCount?: number | null
): string {
  const date = new Date(`${dueDate}T00:00:00`);

  switch (frequency) {
    case 'daily':
      return toISODateString(addDays(date, 1));
    case 'weekly':
      return toISODateString(addDays(date, 7));
    case 'biweekly':
      return toISODateString(addDays(date, 14));
    case 'monthly':
      return toISODateString(addMonths(date, 1));
    case 'quarterly':
      return toISODateString(addMonths(date, 3));
    case 'semi_annual':
      return toISODateString(addMonths(date, 6));
    case 'annual':
      return toISODateString(addMonths(date, 12));
    case 'custom': {
      if (!customIntervalUnit || !customIntervalCount) {
        throw new Error('custom frequency requires customIntervalUnit and customIntervalCount');
      }
      if (customIntervalUnit === 'day') return toISODateString(addDays(date, customIntervalCount));
      if (customIntervalUnit === 'week') return toISODateString(addWeeks(date, customIntervalCount));
      return toISODateString(addMonths(date, customIntervalCount));
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/recurring-date-math.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/recurring-types.ts lib/recurring-date-math.ts lib/recurring-date-math.test.ts
git commit -m "feat: add recurring series types and month-end-safe interval date math"
```

---

### Task 3: Pure next-occurrence generation logic

**Files:**
- Create: `lib/recurring-generation.ts`
- Test: `lib/recurring-generation.test.ts`

**Interfaces:**
- Consumes: `addInterval` from `lib/recurring-date-math.ts` (Task 2); `RecurringSeries` from `lib/recurring-types.ts` (Task 2).
- Produces: `ClosedCycleRow` interface (`{ dueDate: string, cycleNumber: number }`), `NewCycleInput` interface (`{ dueDate: string, cycleNumber: number }`), `computeNextOccurrence(closedRow: ClosedCycleRow, series: RecurringSeries): NewCycleInput | null`. Consumed by Task 6 (`bills-repository.ts`'s `closeBillCycle`) and Task 7 (`reminders-repository.ts`'s `closeReminderCycle`).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/recurring-generation.test.ts
import { describe, expect, it } from 'vitest';
import { computeNextOccurrence } from './recurring-generation';
import type { RecurringSeries } from './recurring-types';

const baseSeries: RecurringSeries = {
  id: 'series-1',
  entityType: 'bill',
  frequency: 'monthly',
  customIntervalUnit: null,
  customIntervalCount: null,
  amountMode: 'fixed',
  autoRenew: true,
  endDate: null,
  maxOccurrences: null,
  occurrencesGenerated: 1,
  status: 'active',
};

describe('computeNextOccurrence', () => {
  it('computes the next cycle for an active, auto-renewing series', () => {
    const result = computeNextOccurrence({ dueDate: '2026-08-01', cycleNumber: 1 }, baseSeries);
    expect(result).toEqual({ dueDate: '2026-09-01', cycleNumber: 2 });
  });

  it('returns null for a paused series', () => {
    const result = computeNextOccurrence({ dueDate: '2026-08-01', cycleNumber: 1 }, { ...baseSeries, status: 'paused' });
    expect(result).toBeNull();
  });

  it('returns null for a stopped series', () => {
    const result = computeNextOccurrence({ dueDate: '2026-08-01', cycleNumber: 1 }, { ...baseSeries, status: 'stopped' });
    expect(result).toBeNull();
  });

  it('stops once the computed next date passes end_date when auto_renew is false', () => {
    const series: RecurringSeries = { ...baseSeries, autoRenew: false, endDate: '2026-08-15' };
    const result = computeNextOccurrence({ dueDate: '2026-08-01', cycleNumber: 1 }, series);
    expect(result).toBeNull();
  });

  it('still generates when the next date is exactly on end_date', () => {
    const series: RecurringSeries = { ...baseSeries, autoRenew: false, endDate: '2026-09-01' };
    const result = computeNextOccurrence({ dueDate: '2026-08-01', cycleNumber: 1 }, series);
    expect(result).toEqual({ dueDate: '2026-09-01', cycleNumber: 2 });
  });

  it('stops once max_occurrences is reached when auto_renew is false', () => {
    const series: RecurringSeries = { ...baseSeries, autoRenew: false, maxOccurrences: 1, occurrencesGenerated: 1 };
    const result = computeNextOccurrence({ dueDate: '2026-08-01', cycleNumber: 1 }, series);
    expect(result).toBeNull();
  });

  it('generates when occurrences_generated is still below max_occurrences', () => {
    const series: RecurringSeries = { ...baseSeries, autoRenew: false, maxOccurrences: 3, occurrencesGenerated: 1 };
    const result = computeNextOccurrence({ dueDate: '2026-08-01', cycleNumber: 1 }, series);
    expect(result).toEqual({ dueDate: '2026-09-01', cycleNumber: 2 });
  });

  it('ignores end_date/max_occurrences entirely when auto_renew is true', () => {
    const series: RecurringSeries = { ...baseSeries, autoRenew: true, endDate: '2026-08-02', maxOccurrences: 1 };
    const result = computeNextOccurrence({ dueDate: '2026-08-01', cycleNumber: 1 }, series);
    expect(result).toEqual({ dueDate: '2026-09-01', cycleNumber: 2 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/recurring-generation.test.ts`
Expected: FAIL with "Cannot find module './recurring-generation'"

- [ ] **Step 3: Write the implementation**

```typescript
// lib/recurring-generation.ts
import { addInterval } from './recurring-date-math';
import type { RecurringSeries } from './recurring-types';

export interface ClosedCycleRow {
  dueDate: string;
  cycleNumber: number;
}

export interface NewCycleInput {
  dueDate: string;
  cycleNumber: number;
}

export function computeNextOccurrence(closedRow: ClosedCycleRow, series: RecurringSeries): NewCycleInput | null {
  if (series.status !== 'active') return null;

  const nextDueDate = addInterval(closedRow.dueDate, series.frequency, series.customIntervalUnit, series.customIntervalCount);

  if (!series.autoRenew) {
    if (series.endDate && nextDueDate > series.endDate) return null;
    if (series.maxOccurrences !== null && series.occurrencesGenerated >= series.maxOccurrences) return null;
  }

  return { dueDate: nextDueDate, cycleNumber: closedRow.cycleNumber + 1 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/recurring-generation.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/recurring-generation.ts lib/recurring-generation.test.ts
git commit -m "feat: add pure next-occurrence generation logic for recurring series"
```

---

### Task 4: Recurring series repository

**Files:**
- Create: `lib/recurring-series-repository.ts`
- Test: `lib/recurring-series-repository.test.ts`

**Interfaces:**
- Consumes: `createClient` from `lib/supabase/client.ts`; `RecurringSeries`, `CreateSeriesInput`, `SeriesStatus` from `lib/recurring-types.ts` (Task 2).
- Produces: `createSeries(input: CreateSeriesInput): Promise<RecurringSeries>`, `getSeries(id: string): Promise<RecurringSeries>`, `updateSeriesStatus(id: string, status: SeriesStatus): Promise<void>`, `incrementOccurrencesGenerated(id: string, newCount: number): Promise<void>`. Consumed by Task 6 (`bills-repository.ts`) and Task 7 (`reminders-repository.ts`).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/recurring-series-repository.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSeries, getSeries, updateSeriesStatus, incrementOccurrencesGenerated } from './recurring-series-repository';

const insertSelectSingleMock = vi.fn();
const insertMock = vi.fn(() => ({ select: () => ({ single: insertSelectSingleMock }) }));
const selectEqSingleMock = vi.fn();
const selectMock = vi.fn(() => ({ eq: () => ({ single: selectEqSingleMock }) }));
const updateEqMock = vi.fn();
const updateMock = vi.fn(() => ({ eq: updateEqMock }));

vi.mock('./supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table !== 'recurring_series') throw new Error(`Unexpected table: ${table}`);
      return { insert: insertMock, select: selectMock, update: updateMock };
    },
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const seriesRow = {
  id: 'series-1',
  entity_type: 'bill',
  frequency: 'monthly',
  custom_interval_unit: null,
  custom_interval_count: null,
  amount_mode: 'fixed',
  auto_renew: true,
  end_date: null,
  max_occurrences: null,
  occurrences_generated: 1,
  status: 'active',
};

const expectedSeries = {
  id: 'series-1',
  entityType: 'bill',
  frequency: 'monthly',
  customIntervalUnit: null,
  customIntervalCount: null,
  amountMode: 'fixed',
  autoRenew: true,
  endDate: null,
  maxOccurrences: null,
  occurrencesGenerated: 1,
  status: 'active',
};

describe('createSeries', () => {
  it('inserts a series row and maps it back', async () => {
    insertSelectSingleMock.mockResolvedValue({ data: seriesRow, error: null });
    const result = await createSeries({ entityType: 'bill', frequency: 'monthly' });
    expect(insertMock).toHaveBeenCalledWith({
      entity_type: 'bill',
      frequency: 'monthly',
      custom_interval_unit: null,
      custom_interval_count: null,
      amount_mode: 'fixed',
      auto_renew: true,
      end_date: null,
      max_occurrences: null,
    });
    expect(result).toEqual(expectedSeries);
  });
});

describe('getSeries', () => {
  it('fetches a series by id and maps it back', async () => {
    selectEqSingleMock.mockResolvedValue({ data: seriesRow, error: null });
    const result = await getSeries('series-1');
    expect(result).toEqual(expectedSeries);
  });
});

describe('updateSeriesStatus', () => {
  it('updates the status column', async () => {
    updateEqMock.mockResolvedValue({ error: null });
    await updateSeriesStatus('series-1', 'paused');
    expect(updateMock).toHaveBeenCalledWith({ status: 'paused' });
    expect(updateEqMock).toHaveBeenCalledWith('id', 'series-1');
  });
});

describe('incrementOccurrencesGenerated', () => {
  it('sets occurrences_generated to the given count', async () => {
    updateEqMock.mockResolvedValue({ error: null });
    await incrementOccurrencesGenerated('series-1', 2);
    expect(updateMock).toHaveBeenCalledWith({ occurrences_generated: 2 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/recurring-series-repository.test.ts`
Expected: FAIL with "Cannot find module './recurring-series-repository'"

- [ ] **Step 3: Write the implementation**

```typescript
// lib/recurring-series-repository.ts
import { createClient } from './supabase/client';
import type { RecurringSeries, CreateSeriesInput, SeriesStatus } from './recurring-types';

interface SeriesRow {
  id: string;
  entity_type: string;
  frequency: string;
  custom_interval_unit: string | null;
  custom_interval_count: number | null;
  amount_mode: string;
  auto_renew: boolean;
  end_date: string | null;
  max_occurrences: number | null;
  occurrences_generated: number;
  status: string;
}

function rowToSeries(row: SeriesRow): RecurringSeries {
  return {
    id: row.id,
    entityType: row.entity_type as RecurringSeries['entityType'],
    frequency: row.frequency as RecurringSeries['frequency'],
    customIntervalUnit: row.custom_interval_unit as RecurringSeries['customIntervalUnit'],
    customIntervalCount: row.custom_interval_count,
    amountMode: row.amount_mode as RecurringSeries['amountMode'],
    autoRenew: row.auto_renew,
    endDate: row.end_date,
    maxOccurrences: row.max_occurrences,
    occurrencesGenerated: row.occurrences_generated,
    status: row.status as SeriesStatus,
  };
}

export async function createSeries(input: CreateSeriesInput): Promise<RecurringSeries> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('recurring_series')
    .insert({
      entity_type: input.entityType,
      frequency: input.frequency,
      custom_interval_unit: input.customIntervalUnit ?? null,
      custom_interval_count: input.customIntervalCount ?? null,
      amount_mode: input.amountMode ?? 'fixed',
      auto_renew: input.autoRenew ?? true,
      end_date: input.endDate ?? null,
      max_occurrences: input.maxOccurrences ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToSeries(data as SeriesRow);
}

export async function getSeries(id: string): Promise<RecurringSeries> {
  const supabase = createClient();
  const { data, error } = await supabase.from('recurring_series').select('*').eq('id', id).single();
  if (error) throw error;
  return rowToSeries(data as SeriesRow);
}

export async function updateSeriesStatus(id: string, status: SeriesStatus): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('recurring_series').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function incrementOccurrencesGenerated(id: string, newCount: number): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('recurring_series').update({ occurrences_generated: newCount }).eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/recurring-series-repository.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/recurring-series-repository.ts lib/recurring-series-repository.test.ts
git commit -m "feat: add recurring series repository"
```

---

### Task 5: Extend `bills-types.ts` and `bills-repository.ts`

**Files:**
- Modify: `lib/bills-types.ts`
- Modify: `lib/bills-repository.ts`
- Modify: `lib/bills-repository.test.ts`

**Interfaces:**
- Consumes: `computeNextOccurrence` from `lib/recurring-generation.ts` (Task 3); `createSeries`, `getSeries`, `incrementOccurrencesGenerated` from `lib/recurring-series-repository.ts` (Task 4); `CreateSeriesInput` from `lib/recurring-types.ts` (Task 2).
- Produces: `Bill` gains `seriesId: string | null`, `cycleNumber: number | null`, `skipped: boolean`. `createRecurringBill(billInput: { title: string; categoryId: string; amount: number; dueDate: string }, seriesInput: Omit<CreateSeriesInput, 'entityType'>): Promise<BillWithCategoryId>`. `closeBillCycle(id: string, action: 'paid' | 'skipped'): Promise<void>`. Consumed by Task 8 (`use-bills.ts`).

- [ ] **Step 1: Update the type**

```typescript
// lib/bills-types.ts
export type RecurrenceInterval = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | null;

export interface Bill {
  id: string;
  title: string;
  category: string;
  amount: number;
  dueDate: string; // ISO 'yyyy-MM-dd'
  recurrence: RecurrenceInterval;
  paid: boolean;
  seriesId: string | null;
  cycleNumber: number | null;
  skipped: boolean;
}

export type BillStatus = 'paid' | 'overdue' | 'due-soon' | 'upcoming';
```

- [ ] **Step 2: Write the failing test additions**

Add to `lib/bills-repository.test.ts` (extend the existing `billRow` fixture and add new
`describe` blocks — keep the existing tests, which will need their expected objects
updated to include the three new fields):

```typescript
// At the top of the file, add a new mock alongside the existing ones and extend the
// `from('bills')` select() to support both the existing .order() chain (listBills) and
// a new .eq().single() chain (closeBillCycle's row fetch):
const selectEqSingleMock = vi.fn();
// Change the mock factory's returned object from:
//   select: () => ({ order: selectOrderMock }),
// to:
//   select: () => ({ order: selectOrderMock, eq: () => ({ single: selectEqSingleMock }) }),

// Update the shared fixture:
const billRow = {
  id: 'bill-1',
  title: 'Rent',
  category_id: 'cat-1',
  amount: 1450,
  due_date: '2026-08-16',
  recurrence: 'monthly',
  paid: true,
  created_at: '2026-08-15T10:00:00.000Z',
  categories: { name: 'Housing' },
  series_id: null,
  cycle_number: null,
  skipped: false,
};

// Update every existing `toEqual`/expectation in this file that lists a bill object
// to also include: seriesId: null, cycleNumber: null, skipped: false.

// closeBillCycle fetches the current row via select('*, categories(name)').eq('id',
// id).single() -- a different chain shape than listBills' select().order(). Extend the
// shared `from('bills')` mock at the top of the file so select() supports both chains
// off one object, instead of trying to re-mock createClient per test:
//
//   const selectEqSingleMock = vi.fn();
//   ...
//   return {
//     select: () => ({ order: selectOrderMock, eq: () => ({ single: selectEqSingleMock }) }),
//     insert: insertMock,
//     update: updateMock,
//     delete: deleteMock,
//   };

// New at the bottom of the file:
import { createRecurringBill, closeBillCycle } from './bills-repository';
import { createSeries, getSeries, incrementOccurrencesGenerated } from './recurring-series-repository';

vi.mock('./recurring-series-repository', () => ({
  createSeries: vi.fn(),
  getSeries: vi.fn(),
  incrementOccurrencesGenerated: vi.fn(),
}));

describe('createRecurringBill', () => {
  it('creates the series, then the first bill row with cycle_number 1', async () => {
    vi.mocked(createSeries).mockResolvedValue({
      id: 'series-1',
      entityType: 'bill',
      frequency: 'monthly',
      customIntervalUnit: null,
      customIntervalCount: null,
      amountMode: 'fixed',
      autoRenew: true,
      endDate: null,
      maxOccurrences: null,
      occurrencesGenerated: 1,
      status: 'active',
    });
    insertSelectSingleMock.mockResolvedValue({
      data: { ...billRow, series_id: 'series-1', cycle_number: 1 },
      error: null,
    });

    const result = await createRecurringBill(
      { title: 'Rent', categoryId: 'cat-1', amount: 1450, dueDate: '2026-08-16' },
      { frequency: 'monthly' }
    );

    expect(createSeries).toHaveBeenCalledWith({ frequency: 'monthly', entityType: 'bill' });
    expect(insertMock).toHaveBeenCalledWith({
      title: 'Rent',
      category_id: 'cat-1',
      amount: 1450,
      due_date: '2026-08-16',
      recurrence: null,
      series_id: 'series-1',
      cycle_number: 1,
    });
    expect(result.seriesId).toBe('series-1');
  });
});

describe('closeBillCycle', () => {
  const openSeriesRow = { ...billRow, paid: false, series_id: 'series-1', cycle_number: 1 };
  const activeMonthlySeries = {
    id: 'series-1',
    entityType: 'bill' as const,
    frequency: 'monthly' as const,
    customIntervalUnit: null,
    customIntervalCount: null,
    amountMode: 'fixed' as const,
    autoRenew: true,
    endDate: null,
    maxOccurrences: null,
    occurrencesGenerated: 1,
    status: 'active' as const,
  };

  it('marks the row paid and generates the next cycle for an active series', async () => {
    selectEqSingleMock.mockResolvedValue({ data: openSeriesRow, error: null });
    updateEqMock.mockResolvedValue({ error: null });
    insertSelectSingleMock.mockResolvedValue({ data: billRow, error: null });
    vi.mocked(getSeries).mockResolvedValue(activeMonthlySeries);

    await closeBillCycle('bill-1', 'paid');

    expect(updateMock).toHaveBeenCalledWith({ paid: true });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ series_id: 'series-1', cycle_number: 2, due_date: '2026-09-16' })
    );
    expect(incrementOccurrencesGenerated).toHaveBeenCalledWith('series-1', 2);
  });

  it('marks the row skipped without a payment date, still advancing the cycle', async () => {
    selectEqSingleMock.mockResolvedValue({ data: openSeriesRow, error: null });
    updateEqMock.mockResolvedValue({ error: null });
    insertSelectSingleMock.mockResolvedValue({ data: billRow, error: null });
    vi.mocked(getSeries).mockResolvedValue(activeMonthlySeries);

    await closeBillCycle('bill-1', 'skipped');

    expect(updateMock).toHaveBeenCalledWith({ skipped: true });
    expect(insertMock).toHaveBeenCalled();
  });

  it('does nothing further when the row has no series_id', async () => {
    selectEqSingleMock.mockResolvedValue({ data: { ...billRow, series_id: null, cycle_number: null }, error: null });
    updateEqMock.mockResolvedValue({ error: null });

    await closeBillCycle('bill-1', 'paid');

    expect(updateMock).toHaveBeenCalledWith({ paid: true });
    expect(insertMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/bills-repository.test.ts`
Expected: FAIL — `createRecurringBill`/`closeBillCycle` don't exist yet, and the updated
`billRow`/expectation fixtures don't match the current `rowToBill` output (missing
`seriesId`/`cycleNumber`/`skipped`)

- [ ] **Step 4: Write the implementation**

```typescript
// lib/bills-repository.ts
import { createClient } from './supabase/client';
import type { Bill, RecurrenceInterval } from './bills-types';
import type { CreateSeriesInput } from './recurring-types';
import { createSeries, getSeries, incrementOccurrencesGenerated } from './recurring-series-repository';
import { computeNextOccurrence } from './recurring-generation';

interface BillRow {
  id: string;
  title: string;
  category_id: string;
  amount: number;
  due_date: string;
  recurrence: string | null;
  paid: boolean;
  created_at: string;
  categories: { name: string } | null;
  series_id: string | null;
  cycle_number: number | null;
  skipped: boolean;
}

export interface BillWithCategoryId extends Bill {
  categoryId: string;
}

function rowToBill(row: BillRow): BillWithCategoryId {
  return {
    id: row.id,
    title: row.title,
    category: row.categories?.name ?? '',
    categoryId: row.category_id,
    amount: row.amount,
    dueDate: row.due_date,
    recurrence: row.recurrence as RecurrenceInterval,
    paid: row.paid,
    seriesId: row.series_id,
    cycleNumber: row.cycle_number,
    skipped: row.skipped,
  };
}

export async function listBills(): Promise<BillWithCategoryId[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('bills')
    .select('*, categories(name)')
    .order('due_date', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as BillRow[]).map(rowToBill);
}

export async function createBill(input: {
  title: string;
  categoryId: string;
  amount: number;
  dueDate: string;
  recurrence: RecurrenceInterval;
}): Promise<BillWithCategoryId> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('bills')
    .insert({
      title: input.title,
      category_id: input.categoryId,
      amount: input.amount,
      due_date: input.dueDate,
      recurrence: input.recurrence,
    })
    .select('*, categories(name)')
    .single();
  if (error) throw error;
  return rowToBill(data as BillRow);
}

export async function createRecurringBill(
  billInput: { title: string; categoryId: string; amount: number; dueDate: string },
  seriesInput: Omit<CreateSeriesInput, 'entityType'>
): Promise<BillWithCategoryId> {
  const series = await createSeries({ ...seriesInput, entityType: 'bill' });
  const supabase = createClient();
  const { data, error } = await supabase
    .from('bills')
    .insert({
      title: billInput.title,
      category_id: billInput.categoryId,
      amount: billInput.amount,
      due_date: billInput.dueDate,
      recurrence: null,
      series_id: series.id,
      cycle_number: 1,
    })
    .select('*, categories(name)')
    .single();
  if (error) throw error;
  return rowToBill(data as BillRow);
}

export async function updateBill(
  id: string,
  patch: Partial<{ title: string; categoryId: string; amount: number; dueDate: string; recurrence: RecurrenceInterval; paid: boolean }>
): Promise<void> {
  const supabase = createClient();
  const payload: Record<string, unknown> = {};
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.categoryId !== undefined) payload.category_id = patch.categoryId;
  if (patch.amount !== undefined) payload.amount = patch.amount;
  if (patch.dueDate !== undefined) payload.due_date = patch.dueDate;
  if (patch.recurrence !== undefined) payload.recurrence = patch.recurrence;
  if (patch.paid !== undefined) payload.paid = patch.paid;

  const { error } = await supabase.from('bills').update(payload).eq('id', id);
  if (error) throw error;
}

export async function closeBillCycle(id: string, action: 'paid' | 'skipped'): Promise<void> {
  const supabase = createClient();
  const { data: currentRow, error: fetchError } = await supabase.from('bills').select('*, categories(name)').eq('id', id).single();
  if (fetchError) throw fetchError;
  const current = rowToBill(currentRow as BillRow);

  const closePayload = action === 'paid' ? { paid: true } : { skipped: true };
  const { error: updateError } = await supabase.from('bills').update(closePayload).eq('id', id);
  if (updateError) throw updateError;

  if (!current.seriesId || current.cycleNumber === null) return;

  const series = await getSeries(current.seriesId);
  const next = computeNextOccurrence({ dueDate: current.dueDate, cycleNumber: current.cycleNumber }, series);
  if (!next) return;

  const { error: insertError } = await supabase.from('bills').insert({
    title: current.title,
    category_id: current.categoryId,
    amount: current.amount,
    due_date: next.dueDate,
    recurrence: null,
    series_id: current.seriesId,
    cycle_number: next.cycleNumber,
  });
  if (insertError) throw insertError;

  await incrementOccurrencesGenerated(current.seriesId, series.occurrencesGenerated + 1);
}

export async function deleteBill(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('bills').delete().eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/bills-repository.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/bills-types.ts lib/bills-repository.ts lib/bills-repository.test.ts
git commit -m "feat: add recurring cycle fields and generation orchestration to bills-repository"
```

---

### Task 6: Extend `reminders-types.ts` and `reminders-repository.ts`

**Files:**
- Modify: `lib/reminders-types.ts`
- Modify: `lib/reminders-repository.ts`
- Modify: `lib/reminders-repository.test.ts`

**Interfaces:**
- Consumes: same as Task 5, mirrored for reminders.
- Produces: `Reminder` gains `seriesId: string | null`, `cycleNumber: number | null`, `skipped: boolean`. `createRecurringReminder(reminderInput: { title: string; category: string; dueDate: string; priority: Priority }, seriesInput: Omit<CreateSeriesInput, 'entityType'>): Promise<Reminder>`. `closeReminderCycle(id: string, action: 'completed' | 'skipped'): Promise<void>`. Consumed by Task 9 (`use-reminders.ts`).

- [ ] **Step 1: Update the type**

```typescript
// lib/reminders-types.ts
export type Priority = 'high' | 'medium' | 'low';

export interface Reminder {
  id: string;
  title: string;
  category: string;
  dueDate: string; // ISO 'yyyy-MM-dd'
  priority: Priority;
  completed: boolean;
  seriesId: string | null;
  cycleNumber: number | null;
  skipped: boolean;
}
```

- [ ] **Step 2: Write the failing test additions**

Add to `lib/reminders-repository.test.ts` (check its current content first —
`ls lib/reminders-repository.test.ts` — and follow the same pattern as Task 5's bills
test: extend the shared row fixture with `series_id: null, cycle_number: null,
skipped: false`, update existing expectations to include the mapped
`seriesId`/`cycleNumber`/`skipped` fields, add a `selectEqSingleMock` and extend the
`from('reminders')` mock's `select()` to return `{ order: selectOrderMock, eq: () =>
({ single: selectEqSingleMock }) }` exactly as in Task 5 Step 2 — `closeReminderCycle`
fetches the current row via `.select().eq().single()`, a different chain than
`listReminders`' `.select().order()` — then add):

```typescript
import { createRecurringReminder, closeReminderCycle } from './reminders-repository';
import { createSeries, getSeries, incrementOccurrencesGenerated } from './recurring-series-repository';

vi.mock('./recurring-series-repository', () => ({
  createSeries: vi.fn(),
  getSeries: vi.fn(),
  incrementOccurrencesGenerated: vi.fn(),
}));

describe('createRecurringReminder', () => {
  it('creates the series, then the first reminder row with cycle_number 1', async () => {
    vi.mocked(createSeries).mockResolvedValue({
      id: 'series-2',
      entityType: 'reminder',
      frequency: 'weekly',
      customIntervalUnit: null,
      customIntervalCount: null,
      amountMode: 'fixed',
      autoRenew: true,
      endDate: null,
      maxOccurrences: null,
      occurrencesGenerated: 1,
      status: 'active',
    });
    insertSelectSingleMock.mockResolvedValue({
      data: { id: 'reminder-1', title: 'Water plants', category: 'Home', due_date: '2026-08-16', priority: 'low', completed: false, created_at: '2026-08-15T10:00:00.000Z', series_id: 'series-2', cycle_number: 1, skipped: false },
      error: null,
    });

    const result = await createRecurringReminder(
      { title: 'Water plants', category: 'Home', dueDate: '2026-08-16', priority: 'low' },
      { frequency: 'weekly' }
    );

    expect(createSeries).toHaveBeenCalledWith({ frequency: 'weekly', entityType: 'reminder' });
    expect(result.seriesId).toBe('series-2');
  });
});

describe('closeReminderCycle', () => {
  it('marks the row completed and generates the next cycle for an active series', async () => {
    const openSeriesRow = { id: 'reminder-1', title: 'Water plants', category: 'Home', due_date: '2026-08-16', priority: 'low', completed: false, created_at: '2026-08-15T10:00:00.000Z', series_id: 'series-2', cycle_number: 1, skipped: false };
    selectEqSingleMock.mockResolvedValue({ data: openSeriesRow, error: null });
    updateEqMock.mockResolvedValue({ error: null });
    insertSelectSingleMock.mockResolvedValue({ data: openSeriesRow, error: null });
    vi.mocked(getSeries).mockResolvedValue({
      id: 'series-2',
      entityType: 'reminder',
      frequency: 'weekly',
      customIntervalUnit: null,
      customIntervalCount: null,
      amountMode: 'fixed',
      autoRenew: true,
      endDate: null,
      maxOccurrences: null,
      occurrencesGenerated: 1,
      status: 'active',
    });

    await closeReminderCycle('reminder-1', 'completed');

    expect(updateMock).toHaveBeenCalledWith({ completed: true });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ series_id: 'series-2', cycle_number: 2, due_date: '2026-08-23' })
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/reminders-repository.test.ts`
Expected: FAIL — `createRecurringReminder`/`closeReminderCycle` don't exist yet

- [ ] **Step 4: Write the implementation**

```typescript
// lib/reminders-repository.ts
import { createClient } from './supabase/client';
import type { Reminder, Priority } from './reminders-types';
import type { CreateSeriesInput } from './recurring-types';
import { createSeries, getSeries, incrementOccurrencesGenerated } from './recurring-series-repository';
import { computeNextOccurrence } from './recurring-generation';

interface ReminderRow {
  id: string;
  title: string;
  category: string;
  due_date: string;
  priority: string;
  completed: boolean;
  created_at: string;
  series_id: string | null;
  cycle_number: number | null;
  skipped: boolean;
}

function rowToReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    dueDate: row.due_date,
    priority: row.priority as Priority,
    completed: row.completed,
    seriesId: row.series_id,
    cycleNumber: row.cycle_number,
    skipped: row.skipped,
  };
}

export async function listReminders(): Promise<Reminder[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from('reminders').select('*').order('due_date', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as ReminderRow[]).map(rowToReminder);
}

export async function createReminder(input: { title: string; category: string; dueDate: string; priority: Priority }): Promise<Reminder> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('reminders')
    .insert({ title: input.title, category: input.category, due_date: input.dueDate, priority: input.priority })
    .select()
    .single();
  if (error) throw error;
  return rowToReminder(data as ReminderRow);
}

export async function createRecurringReminder(
  reminderInput: { title: string; category: string; dueDate: string; priority: Priority },
  seriesInput: Omit<CreateSeriesInput, 'entityType'>
): Promise<Reminder> {
  const series = await createSeries({ ...seriesInput, entityType: 'reminder' });
  const supabase = createClient();
  const { data, error } = await supabase
    .from('reminders')
    .insert({
      title: reminderInput.title,
      category: reminderInput.category,
      due_date: reminderInput.dueDate,
      priority: reminderInput.priority,
      series_id: series.id,
      cycle_number: 1,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToReminder(data as ReminderRow);
}

export async function updateReminder(
  id: string,
  patch: Partial<{ title: string; category: string; dueDate: string; priority: Priority; completed: boolean }>
): Promise<void> {
  const supabase = createClient();
  const payload: Record<string, unknown> = {};
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.category !== undefined) payload.category = patch.category;
  if (patch.dueDate !== undefined) payload.due_date = patch.dueDate;
  if (patch.priority !== undefined) payload.priority = patch.priority;
  if (patch.completed !== undefined) payload.completed = patch.completed;

  const { error } = await supabase.from('reminders').update(payload).eq('id', id);
  if (error) throw error;
}

export async function closeReminderCycle(id: string, action: 'completed' | 'skipped'): Promise<void> {
  const supabase = createClient();
  const { data: currentRow, error: fetchError } = await supabase.from('reminders').select('*').eq('id', id).single();
  if (fetchError) throw fetchError;
  const current = rowToReminder(currentRow as ReminderRow);

  const closePayload = action === 'completed' ? { completed: true } : { skipped: true };
  const { error: updateError } = await supabase.from('reminders').update(closePayload).eq('id', id);
  if (updateError) throw updateError;

  if (!current.seriesId || current.cycleNumber === null) return;

  const series = await getSeries(current.seriesId);
  const next = computeNextOccurrence({ dueDate: current.dueDate, cycleNumber: current.cycleNumber }, series);
  if (!next) return;

  const { error: insertError } = await supabase.from('reminders').insert({
    title: current.title,
    category: current.category,
    due_date: next.dueDate,
    priority: current.priority,
    series_id: current.seriesId,
    cycle_number: next.cycleNumber,
  });
  if (insertError) throw insertError;

  await incrementOccurrencesGenerated(current.seriesId, series.occurrencesGenerated + 1);
}

export async function deleteReminder(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('reminders').delete().eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/reminders-repository.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/reminders-types.ts lib/reminders-repository.ts lib/reminders-repository.test.ts
git commit -m "feat: add recurring cycle fields and generation orchestration to reminders-repository"
```

---

### Task 7: Wire `use-bills.ts`

**Files:**
- Modify: `lib/use-bills.ts`
- Modify: `lib/use-bills.test.ts`

**Interfaces:**
- Consumes: `createRecurringBill`, `closeBillCycle` from `lib/bills-repository.ts` (Task 5); `CreateSeriesInput` from `lib/recurring-types.ts` (Task 2).
- Produces: `UseBillsResult` gains `createRecurringBill: (billInput: { title: string; categoryId: string; amount: number; dueDate: string }, seriesInput: Omit<CreateSeriesInput, 'entityType'>) => Promise<void>` and `skipCycle: (id: string) => Promise<void>`. `togglePaid` now calls `closeBillCycle(id, 'paid')` instead of a plain `updateBill` when marking a recurring bill paid (false → true transition on a row with a `seriesId`); un-marking (true → false) and non-recurring bills keep the existing plain `updateBill` behavior. Consumed by Task 10 (`BillsPage` wiring).

- [ ] **Step 1: Write the failing test additions**

Add to `lib/use-bills.test.ts` (update the shared `bill` fixture to include
`seriesId: null, cycleNumber: null, skipped: false`, then add):

```typescript
const { createRecurringBillMock, closeBillCycleMock } = vi.hoisted(() => ({
  createRecurringBillMock: vi.fn(),
  closeBillCycleMock: vi.fn(),
}));

vi.mock('./bills-repository', () => ({
  listBills: listBillsMock,
  createBill: createBillMock,
  updateBill: updateBillMock,
  deleteBill: deleteBillMock,
  createRecurringBill: createRecurringBillMock,
  closeBillCycle: closeBillCycleMock,
}));

const recurringBill = { ...bill, id: 'bill-2', seriesId: 'series-1', cycleNumber: 1, paid: false };

describe('useBills recurring behavior', () => {
  it('togglePaid() on a recurring bill closes the cycle via closeBillCycle, not a plain update', async () => {
    listBillsMock.mockResolvedValue([recurringBill]);
    closeBillCycleMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.togglePaid('bill-2');
    });

    expect(closeBillCycleMock).toHaveBeenCalledWith('bill-2', 'paid');
    expect(updateBillMock).not.toHaveBeenCalled();
  });

  it('togglePaid() un-marking a closed recurring bill uses a plain update, not closeBillCycle', async () => {
    listBillsMock.mockResolvedValue([{ ...recurringBill, paid: true }]);
    updateBillMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.togglePaid('bill-2');
    });

    expect(updateBillMock).toHaveBeenCalledWith('bill-2', { paid: false });
    expect(closeBillCycleMock).not.toHaveBeenCalled();
  });

  it('skipCycle() closes the cycle as skipped', async () => {
    listBillsMock.mockResolvedValue([recurringBill]);
    closeBillCycleMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.skipCycle('bill-2');
    });

    expect(closeBillCycleMock).toHaveBeenCalledWith('bill-2', 'skipped');
  });

  it('createRecurringBill() calls the repository and refreshes', async () => {
    listBillsMock.mockResolvedValueOnce([]).mockResolvedValueOnce([recurringBill]);
    createRecurringBillMock.mockResolvedValue(recurringBill);
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createRecurringBill(
        { title: 'Rent', categoryId: 'cat-1', amount: 1450, dueDate: '2026-08-16' },
        { frequency: 'monthly' }
      );
    });

    expect(createRecurringBillMock).toHaveBeenCalledWith(
      { title: 'Rent', categoryId: 'cat-1', amount: 1450, dueDate: '2026-08-16' },
      { frequency: 'monthly' }
    );
    expect(result.current.bills).toEqual([recurringBill]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/use-bills.test.ts`
Expected: FAIL — `createRecurringBill`/`skipCycle` don't exist on the hook's return value yet

- [ ] **Step 3: Write the implementation**

```typescript
// lib/use-bills.ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { listBills, createBill, updateBill, deleteBill, createRecurringBill, closeBillCycle } from './bills-repository';
import type { BillWithCategoryId } from './bills-repository';
import type { RecurrenceInterval } from './bills-types';
import type { CreateSeriesInput } from './recurring-types';

export interface UseBillsResult {
  bills: BillWithCategoryId[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createBill: (input: { title: string; categoryId: string; amount: number; dueDate: string; recurrence: RecurrenceInterval }) => Promise<void>;
  createRecurringBill: (
    billInput: { title: string; categoryId: string; amount: number; dueDate: string },
    seriesInput: Omit<CreateSeriesInput, 'entityType'>
  ) => Promise<void>;
  updateBill: (
    id: string,
    patch: Partial<{ title: string; categoryId: string; amount: number; dueDate: string; recurrence: RecurrenceInterval; paid: boolean }>
  ) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;
  togglePaid: (id: string) => Promise<void>;
  skipCycle: (id: string) => Promise<void>;
}

export function useBills(): UseBillsResult {
  const [bills, setBills] = useState<BillWithCategoryId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await listBills();
      if (requestId !== requestIdRef.current) return;
      setBills(result);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load bills');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const runMutation = useCallback(
    async (fn: () => Promise<unknown>) => {
      setError(null);
      try {
        await fn();
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Action failed';
        setError(message);
        throw err;
      }
    },
    [refresh]
  );

  return {
    bills,
    loading,
    error,
    refresh,
    createBill: (input) => runMutation(() => createBill(input)),
    createRecurringBill: (billInput, seriesInput) => runMutation(() => createRecurringBill(billInput, seriesInput)),
    updateBill: (id, patch) => runMutation(() => updateBill(id, patch)),
    deleteBill: (id) => runMutation(() => deleteBill(id)),
    togglePaid: (id) => {
      const bill = bills.find((b) => b.id === id);
      if (!bill) return Promise.resolve();
      if (!bill.paid && bill.seriesId) {
        return runMutation(() => closeBillCycle(id, 'paid'));
      }
      return runMutation(() => updateBill(id, { paid: !bill.paid }));
    },
    skipCycle: (id) => runMutation(() => closeBillCycle(id, 'skipped')),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/use-bills.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/use-bills.ts lib/use-bills.test.ts
git commit -m "feat: wire recurring bill creation and cycle-close generation into useBills"
```

---

### Task 8: Wire `use-reminders.ts`

**Files:**
- Modify: `lib/use-reminders.ts`
- Modify: `lib/use-reminders.test.ts`

**Interfaces:**
- Consumes: `createRecurringReminder`, `closeReminderCycle` from `lib/reminders-repository.ts` (Task 6).
- Produces: `UseRemindersResult` gains `createRecurringReminder` and `skipCycle`, mirroring Task 7. `toggleComplete` calls `closeReminderCycle(id, 'completed')` on the false→true transition for a row with a `seriesId`. Consumed by Task 11 (`RemindersPage` wiring).

- [ ] **Step 1: Write the failing test additions**

Follow the exact same pattern as Task 7 Step 1, adapted for reminders (check
`lib/use-reminders.test.ts` first for its exact existing mock/fixture shape via `ls` and
`Read`, then mirror the four new test cases: recurring `toggleComplete` closes the
cycle, un-completing uses a plain update, `skipCycle` closes as skipped,
`createRecurringReminder` calls the repository and refreshes).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/use-reminders.test.ts`
Expected: FAIL — `createRecurringReminder`/`skipCycle` don't exist on the hook's return value yet

- [ ] **Step 3: Write the implementation**

```typescript
// lib/use-reminders.ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { addDays, parseISO } from 'date-fns';
import { listReminders, createReminder, updateReminder, deleteReminder, createRecurringReminder, closeReminderCycle } from './reminders-repository';
import { toISODateString } from './date-utils';
import type { Priority, Reminder } from './reminders-types';
import type { CreateSeriesInput } from './recurring-types';

export interface UseRemindersResult {
  reminders: Reminder[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createReminder: (input: { title: string; category: string; dueDate: string; priority: Priority }) => Promise<void>;
  createRecurringReminder: (
    reminderInput: { title: string; category: string; dueDate: string; priority: Priority },
    seriesInput: Omit<CreateSeriesInput, 'entityType'>
  ) => Promise<void>;
  updateReminder: (id: string, patch: Partial<{ title: string; category: string; dueDate: string; priority: Priority; completed: boolean }>) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
  skipCycle: (id: string) => Promise<void>;
  snooze: (id: string) => Promise<void>;
}

export function useReminders(): UseRemindersResult {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await listReminders();
      if (requestId !== requestIdRef.current) return;
      setReminders(result);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load reminders');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const runMutation = useCallback(
    async (fn: () => Promise<unknown>) => {
      setError(null);
      try {
        await fn();
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Action failed';
        setError(message);
        throw err;
      }
    },
    [refresh]
  );

  return {
    reminders,
    loading,
    error,
    refresh,
    createReminder: (input) => runMutation(() => createReminder(input)),
    createRecurringReminder: (reminderInput, seriesInput) => runMutation(() => createRecurringReminder(reminderInput, seriesInput)),
    updateReminder: (id, patch) => runMutation(() => updateReminder(id, patch)),
    deleteReminder: (id) => runMutation(() => deleteReminder(id)),
    toggleComplete: (id) => {
      const reminder = reminders.find((r) => r.id === id);
      if (!reminder) return Promise.resolve();
      if (!reminder.completed && reminder.seriesId) {
        return runMutation(() => closeReminderCycle(id, 'completed'));
      }
      return runMutation(() => updateReminder(id, { completed: !reminder.completed }));
    },
    skipCycle: (id) => runMutation(() => closeReminderCycle(id, 'skipped')),
    snooze: (id) => {
      const reminder = reminders.find((r) => r.id === id);
      if (!reminder) return Promise.resolve();
      const nextDate = toISODateString(addDays(parseISO(reminder.dueDate), 1));
      return runMutation(() => updateReminder(id, { dueDate: nextDate }));
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/use-reminders.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/use-reminders.ts lib/use-reminders.test.ts
git commit -m "feat: wire recurring reminder creation and cycle-close generation into useReminders"
```

---

### Task 9: `RowActionsMenu` gains a Skip action

**Files:**
- Modify: `components/shared/RowActionsMenu.tsx`
- Modify: `components/shared/RowActionsMenu.test.tsx` (check `ls components/shared/RowActionsMenu.test.tsx` first — create following the file's existing test conventions if a test file doesn't exist yet, otherwise extend it)

**Interfaces:**
- Produces: `RowActionsMenuProps` gains `onSkip?: () => void`, rendering a "Skip this cycle" menu item (using lucide-react's `SkipForward` icon) between Edit and Delete when provided. Consumed by Task 10/11 (`BillRow`/`ReminderRow`).

- [ ] **Step 1: Write the failing test**

```typescript
// components/shared/RowActionsMenu.test.tsx (add to existing file, or create new)
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RowActionsMenu } from './RowActionsMenu';

describe('RowActionsMenu skip action', () => {
  it('renders a Skip menu item when onSkip is provided', async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(<RowActionsMenu label="Rent" onEdit={vi.fn()} onDelete={vi.fn()} onSkip={onSkip} />);
    await user.click(screen.getByRole('button', { name: /actions for rent/i }));
    const skipItem = await screen.findByRole('menuitem', { name: /skip/i });
    await user.click(skipItem);
    expect(onSkip).toHaveBeenCalled();
  });

  it('does not render a Skip menu item when onSkip is not provided', async () => {
    const user = userEvent.setup();
    render(<RowActionsMenu label="Rent" onEdit={vi.fn()} onDelete={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /actions for rent/i }));
    expect(screen.queryByRole('menuitem', { name: /skip/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/shared/RowActionsMenu.test.tsx`
Expected: FAIL — no Skip menu item is rendered

- [ ] **Step 3: Write the implementation**

```typescript
// components/shared/RowActionsMenu.tsx
'use client';

import { MoreVertical, Pencil, SkipForward, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

interface RowActionsMenuProps {
  label: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onSkip?: () => void;
}

export function RowActionsMenu({ label, onEdit, onDelete, onSkip }: RowActionsMenuProps) {
  if (!onEdit && !onDelete && !onSkip) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="min-h-11 min-w-11" aria-label={`Actions for ${label}`}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        }
      />
      <DropdownMenuContent>
        {onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            Edit
          </DropdownMenuItem>
        )}
        {onSkip && (
          <DropdownMenuItem onClick={onSkip}>
            <SkipForward className="h-4 w-4" />
            Skip this cycle
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/shared/RowActionsMenu.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/shared/RowActionsMenu.tsx components/shared/RowActionsMenu.test.tsx
git commit -m "feat: add Skip this cycle action to RowActionsMenu"
```

---

### Task 10: Bills — recurring form UI, skip threading, page wiring

**Files:**
- Modify: `components/bills/BillForm.tsx`
- Modify: `components/bills/BillForm.test.tsx`
- Modify: `components/bills/BillRow.tsx`
- Modify: `components/bills/BillsListView.tsx`
- Modify: `app/(shell)/bills/page.tsx`
- Modify: `app/(shell)/bills/page.test.tsx`

**Interfaces:**
- Consumes: `createRecurringBill`, `skipCycle` from `useBills()` (Task 7); `Frequency`, `CustomIntervalUnit`, `AmountMode`, `CreateSeriesInput` from `lib/recurring-types.ts` (Task 2).
- Produces: `BillFormInput` gains optional `series?: Omit<CreateSeriesInput, 'entityType'>` (only settable when creating, not editing). `BillRowProps`/`BillsListViewProps` gain `onSkip?: (bill: Bill) => void`.

- [ ] **Step 1: Write the failing BillForm test additions**

Add to `components/bills/BillForm.test.tsx` (check `ls components/bills/BillForm.test.tsx`
first for its exact existing setup and mirror its conventions):

```typescript
it('shows recurring options when Recurring is selected, and includes them on submit', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<BillForm open categories={categories} onSubmit={onSubmit} onOpenChange={vi.fn()} />);

  await user.type(screen.getByLabelText(/title/i), 'Netflix');
  await user.type(screen.getByLabelText(/amount/i), '15.99');
  await user.type(screen.getByLabelText(/due date/i), '2026-09-01');
  await user.click(screen.getByLabelText(/recurring/i));
  await user.selectOptions(screen.getByLabelText(/frequency/i), 'monthly');
  await user.click(screen.getByRole('button', { name: /^save$/i }));

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Netflix',
      series: expect.objectContaining({ frequency: 'monthly', autoRenew: true }),
    })
  );
});

it('shows custom interval fields only when frequency is Custom', async () => {
  const user = userEvent.setup();
  render(<BillForm open categories={categories} onSubmit={vi.fn()} onOpenChange={vi.fn()} />);
  await user.click(screen.getByLabelText(/recurring/i));
  expect(screen.queryByLabelText(/custom interval count/i)).not.toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText(/frequency/i), 'custom');
  expect(screen.getByLabelText(/custom interval count/i)).toBeInTheDocument();
});
```

(`categories` here is whatever fixture `BillForm.test.tsx` already defines — reuse it,
don't redefine.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/bills/BillForm.test.tsx`
Expected: FAIL — no "Recurring" label/toggle exists yet

- [ ] **Step 3: Rewrite `BillForm.tsx`**

```tsx
// components/bills/BillForm.tsx
'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { RecurrenceInterval } from '@/lib/bills-types';
import type { Category } from '@/lib/categories-types';
import type { Frequency, CustomIntervalUnit, AmountMode, CreateSeriesInput } from '@/lib/recurring-types';

export interface BillFormInput {
  title: string;
  categoryId: string;
  amount: number;
  dueDate: string;
  recurrence: RecurrenceInterval;
  series?: Omit<CreateSeriesInput, 'entityType'>;
}

interface BillFormInitial {
  title: string;
  categoryId: string;
  amount: number;
  dueDate: string;
  recurrence: RecurrenceInterval;
}

interface BillFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  initialBill?: BillFormInitial;
  onSubmit: (input: BillFormInput) => Promise<void>;
}

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semi_annual', label: 'Semi-Annual' },
  { value: 'annual', label: 'Annual' },
  { value: 'custom', label: 'Custom' },
];

export function BillForm({ open, onOpenChange, categories, initialBill, onSubmit }: BillFormProps) {
  const [title, setTitle] = useState(initialBill?.title ?? '');
  const [categoryId, setCategoryId] = useState(initialBill?.categoryId ?? categories[0]?.id ?? '');
  const [amount, setAmount] = useState(initialBill?.amount?.toString() ?? '');
  const [dueDate, setDueDate] = useState(initialBill?.dueDate ?? '');
  const [recurrence, setRecurrence] = useState<RecurrenceInterval>(initialBill?.recurrence ?? null);
  const [submitting, setSubmitting] = useState(false);

  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [customIntervalUnit, setCustomIntervalUnit] = useState<CustomIntervalUnit>('day');
  const [customIntervalCount, setCustomIntervalCount] = useState('1');
  const [amountMode, setAmountMode] = useState<AmountMode>('fixed');
  const [autoRenew, setAutoRenew] = useState(true);
  const [endDate, setEndDate] = useState('');
  const [maxOccurrences, setMaxOccurrences] = useState('');

  const isValid = title.trim() !== '' && categoryId !== '' && amount !== '' && !Number.isNaN(Number(amount)) && dueDate !== '';

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const series =
        !initialBill && isRecurring
          ? {
              frequency,
              ...(frequency === 'custom' ? { customIntervalUnit, customIntervalCount: Number(customIntervalCount) } : {}),
              amountMode,
              autoRenew,
              endDate: !autoRenew && endDate !== '' ? endDate : null,
              maxOccurrences: !autoRenew && maxOccurrences !== '' ? Number(maxOccurrences) : null,
            }
          : undefined;
      await onSubmit({ title: title.trim(), categoryId, amount: Number(amount), dueDate, recurrence, series });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>{initialBill ? 'Edit bill' : 'Add bill'}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bill-title">Title</Label>
            <Input id="bill-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bill-category">Category</Label>
            <select
              id="bill-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-8 rounded-lg border border-neutral-200 px-2 text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bill-amount">Amount</Label>
            <Input id="bill-amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bill-due-date">Due date</Label>
            <Input id="bill-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bill-recurrence">Recurrence</Label>
            <select
              id="bill-recurrence"
              value={recurrence ?? ''}
              onChange={(e) => setRecurrence((e.target.value || null) as RecurrenceInterval)}
              className="h-8 rounded-lg border border-neutral-200 px-2 text-sm"
            >
              <option value="">None</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          {!initialBill && (
            <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-3">
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  id="bill-is-recurring"
                  aria-label="Recurring"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                />
                Recurring
              </label>
              {isRecurring && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="bill-frequency">Frequency</Label>
                    <select
                      id="bill-frequency"
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value as Frequency)}
                      className="h-8 rounded-lg border border-neutral-200 px-2 text-sm"
                    >
                      {FREQUENCY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {frequency === 'custom' && (
                    <div className="flex items-end gap-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="bill-custom-count">Custom interval count</Label>
                        <Input
                          id="bill-custom-count"
                          type="number"
                          min="1"
                          value={customIntervalCount}
                          onChange={(e) => setCustomIntervalCount(e.target.value)}
                        />
                      </div>
                      <select
                        aria-label="Custom interval unit"
                        value={customIntervalUnit}
                        onChange={(e) => setCustomIntervalUnit(e.target.value as CustomIntervalUnit)}
                        className="h-8 rounded-lg border border-neutral-200 px-2 text-sm"
                      >
                        <option value="day">Days</option>
                        <option value="week">Weeks</option>
                        <option value="month">Months</option>
                      </select>
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="bill-amount-mode">Amount</Label>
                    <select
                      id="bill-amount-mode"
                      value={amountMode}
                      onChange={(e) => setAmountMode(e.target.value as AmountMode)}
                      className="h-8 rounded-lg border border-neutral-200 px-2 text-sm"
                    >
                      <option value="fixed">Fixed every cycle</option>
                      <option value="editable">Editable per cycle</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} />
                    Auto-renew (repeats indefinitely)
                  </label>
                  {!autoRenew && (
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="bill-end-date">End date</Label>
                        <Input id="bill-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="bill-max-occurrences"># of occurrences</Label>
                        <Input
                          id="bill-max-occurrences"
                          type="number"
                          min="1"
                          value={maxOccurrences}
                          onChange={(e) => setMaxOccurrences(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        <SheetFooter>
          <Button onClick={handleSubmit} disabled={!isValid || submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Run BillForm test to verify it passes**

Run: `npx vitest run components/bills/BillForm.test.tsx`
Expected: PASS

- [ ] **Step 5: Thread `onSkip` through `BillRow.tsx` and `BillsListView.tsx`**

In `components/bills/BillRow.tsx`, add `onSkip?: (bill: Bill) => void` to `BillRowProps`,
and pass it to `RowActionsMenu` gated on the bill being an open recurring cycle:

```tsx
// components/bills/BillRow.tsx — modify the props interface and the RowActionsMenu call
interface BillRowProps {
  bill: Bill;
  onTogglePaid: (id: string) => void;
  referenceDate?: Date;
  isDuplicate?: boolean;
  onEdit?: (bill: Bill) => void;
  onDelete?: (bill: Bill) => void;
  onSkip?: (bill: Bill) => void;
}

export function BillRow({ bill, onTogglePaid, referenceDate = new Date(), isDuplicate = false, onEdit, onDelete, onSkip }: BillRowProps) {
  // ...unchanged body...
  // replace the RowActionsMenu JSX at the bottom with:
  return (
    // ...unchanged wrapper...
        <RowActionsMenu
          label={bill.title}
          onEdit={onEdit ? () => onEdit(bill) : undefined}
          onDelete={onDelete ? () => onDelete(bill) : undefined}
          onSkip={onSkip && bill.seriesId && !bill.paid ? () => onSkip(bill) : undefined}
        />
    // ...
  );
}
```

In `components/bills/BillsListView.tsx`, add `onSkip?: (bill: Bill) => void` to
`BillsListViewProps`, thread it through the destructured props, and pass it to each
`BillRow`:

```tsx
// components/bills/BillsListView.tsx — add to props interface, destructuring, and the BillRow render call
interface BillsListViewProps {
  bills: Bill[];
  onTogglePaid: (id: string) => void;
  referenceDate?: Date;
  onEdit?: (bill: Bill) => void;
  onDelete?: (bill: Bill) => void;
  onSkip?: (bill: Bill) => void;
}

export function BillsListView({ bills, onTogglePaid, referenceDate = new Date(), onEdit, onDelete, onSkip }: BillsListViewProps) {
  // ...unchanged body up to the BillRow map...
  // <BillRow key={bill.id} bill={bill} ... onEdit={onEdit} onDelete={onDelete} onSkip={onSkip} />
}
```

- [ ] **Step 6: Wire `app/(shell)/bills/page.tsx`**

```tsx
// app/(shell)/bills/page.tsx — inside BillsPageContent, update handleSubmit and the BillsListView/JSX:
async function handleSubmit(input: import('@/components/bills/BillForm').BillFormInput) {
  if (editingBill) {
    await updateBill(editingBill.id, input);
  } else if (input.series) {
    await createRecurringBill({ title: input.title, categoryId: input.categoryId, amount: input.amount, dueDate: input.dueDate }, input.series);
  } else {
    await createBill(input);
  }
}
```

Update the `useBills()` destructure to also pull `createRecurringBill` and `skipCycle`,
and pass `onSkip={(bill) => skipCycle(bill.id)}` to `<BillsListView />`.

- [ ] **Step 7: Write the failing BillsPage test for skip, then verify it passes**

Add to `app/(shell)/bills/page.test.tsx`:

```typescript
it('calls skipCycle when Skip this cycle is chosen for a recurring bill', async () => {
  const skipCycleMock = vi.fn().mockResolvedValue(undefined);
  useBillsMock.mockReturnValue({
    bills: [{ ...bills[1], seriesId: 'series-1', cycleNumber: 1, skipped: false }],
    loading: false,
    error: null,
    refresh: vi.fn(),
    createBill: createBillMock,
    createRecurringBill: vi.fn(),
    updateBill: updateBillMock,
    deleteBill: deleteBillMock,
    togglePaid: togglePaidMock,
    skipCycle: skipCycleMock,
  });
  const user = userEvent.setup();
  render(<BillsPage />);
  await user.click(screen.getByRole('button', { name: /actions for electricity/i }));
  await user.click(await screen.findByRole('menuitem', { name: /skip/i }));
  expect(skipCycleMock).toHaveBeenCalledWith('bill-2');
});
```

(Update the other tests' `useBillsMock.mockReturnValue`/`defaultUseBillsResult` calls in
this file to also include `createRecurringBill: vi.fn()` and `skipCycle: vi.fn()`, since
`useBills()`'s return shape now requires them.)

Run: `npx vitest run "app/(shell)/bills/page.test.tsx"`
Expected: PASS

- [ ] **Step 8: Run the component/page test files together, then commit**

```bash
npx vitest run components/bills components/shared "app/(shell)/bills"
git add components/bills/BillForm.tsx components/bills/BillForm.test.tsx components/bills/BillRow.tsx components/bills/BillsListView.tsx "app/(shell)/bills/page.tsx" "app/(shell)/bills/page.test.tsx"
git commit -m "feat: add recurring bill creation UI and skip-this-cycle action to Bills"
```

---

### Task 11: Reminders — recurring form UI, skip threading, page wiring

**Files:**
- Modify: `components/reminders/ReminderForm.tsx`
- Modify: `components/reminders/ReminderForm.test.tsx`
- Modify: `components/reminders/ReminderRow.tsx`
- Modify: `components/reminders/RemindersListView.tsx`
- Modify: `app/(shell)/reminders/page.tsx`
- Modify: `app/(shell)/reminders/page.test.tsx`

**Interfaces:**
- Consumes: `createRecurringReminder`, `skipCycle` from `useReminders()` (Task 8);
  `Frequency`, `CustomIntervalUnit`, `CreateSeriesInput` from `lib/recurring-types.ts`
  (Task 2).
- Produces: `ReminderFormInput` gains optional `series?: Omit<CreateSeriesInput,
  'entityType' | 'amountMode'>` (reminders have no amount, so `amountMode` is never
  offered in this form — omit that field from the UI and the input type entirely rather
  than showing a control for something meaningless here). `ReminderRowProps`/
  `RemindersListViewProps` gain `onSkip?: (reminder: Reminder) => void`.

- [ ] **Step 1: Write the failing ReminderForm test additions**

Mirror Task 10 Step 1, adapted for reminders (no amount/amount-mode field):

```typescript
it('shows recurring options when Recurring is selected, and includes them on submit', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<ReminderForm open onSubmit={onSubmit} onOpenChange={vi.fn()} />);

  await user.type(screen.getByLabelText(/title/i), 'Water plants');
  await user.type(screen.getByLabelText(/category/i), 'Home');
  await user.type(screen.getByLabelText(/due date/i), '2026-09-01');
  await user.click(screen.getByLabelText(/recurring/i));
  await user.selectOptions(screen.getByLabelText(/frequency/i), 'weekly');
  await user.click(screen.getByRole('button', { name: /^save$/i }));

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Water plants',
      series: expect.objectContaining({ frequency: 'weekly', autoRenew: true }),
    })
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/reminders/ReminderForm.test.tsx`
Expected: FAIL — no "Recurring" label/toggle exists yet

- [ ] **Step 3: Rewrite `ReminderForm.tsx`**

```tsx
// components/reminders/ReminderForm.tsx
'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { Priority } from '@/lib/reminders-types';
import type { Frequency, CustomIntervalUnit, CreateSeriesInput } from '@/lib/recurring-types';

export interface ReminderFormInput {
  title: string;
  category: string;
  dueDate: string;
  priority: Priority;
  series?: Omit<CreateSeriesInput, 'entityType' | 'amountMode'>;
}

interface ReminderFormInitial {
  title: string;
  category: string;
  dueDate: string;
  priority: Priority;
}

interface ReminderFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialReminder?: ReminderFormInitial;
  onSubmit: (input: ReminderFormInput) => Promise<void>;
}

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semi_annual', label: 'Semi-Annual' },
  { value: 'annual', label: 'Annual' },
  { value: 'custom', label: 'Custom' },
];

export function ReminderForm({ open, onOpenChange, initialReminder, onSubmit }: ReminderFormProps) {
  const [title, setTitle] = useState(initialReminder?.title ?? '');
  const [category, setCategory] = useState(initialReminder?.category ?? '');
  const [dueDate, setDueDate] = useState(initialReminder?.dueDate ?? '');
  const [priority, setPriority] = useState<Priority>(initialReminder?.priority ?? 'medium');
  const [submitting, setSubmitting] = useState(false);

  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>('weekly');
  const [customIntervalUnit, setCustomIntervalUnit] = useState<CustomIntervalUnit>('day');
  const [customIntervalCount, setCustomIntervalCount] = useState('1');
  const [autoRenew, setAutoRenew] = useState(true);
  const [endDate, setEndDate] = useState('');
  const [maxOccurrences, setMaxOccurrences] = useState('');

  const isValid = title.trim() !== '' && category.trim() !== '' && dueDate !== '';

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const series =
        !initialReminder && isRecurring
          ? {
              frequency,
              ...(frequency === 'custom' ? { customIntervalUnit, customIntervalCount: Number(customIntervalCount) } : {}),
              autoRenew,
              endDate: !autoRenew && endDate !== '' ? endDate : null,
              maxOccurrences: !autoRenew && maxOccurrences !== '' ? Number(maxOccurrences) : null,
            }
          : undefined;
      await onSubmit({ title: title.trim(), category: category.trim(), dueDate, priority, series });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>{initialReminder ? 'Edit reminder' : 'Add reminder'}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reminder-title">Title</Label>
            <Input id="reminder-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reminder-category">Category</Label>
            <Input id="reminder-category" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reminder-due-date">Due date</Label>
            <Input id="reminder-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reminder-priority">Priority</Label>
            <select
              id="reminder-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="h-8 rounded-lg border border-neutral-200 px-2 text-sm"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          {!initialReminder && (
            <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-3">
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  id="reminder-is-recurring"
                  aria-label="Recurring"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                />
                Recurring
              </label>
              {isRecurring && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="reminder-frequency">Frequency</Label>
                    <select
                      id="reminder-frequency"
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value as Frequency)}
                      className="h-8 rounded-lg border border-neutral-200 px-2 text-sm"
                    >
                      {FREQUENCY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {frequency === 'custom' && (
                    <div className="flex items-end gap-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="reminder-custom-count">Custom interval count</Label>
                        <Input
                          id="reminder-custom-count"
                          type="number"
                          min="1"
                          value={customIntervalCount}
                          onChange={(e) => setCustomIntervalCount(e.target.value)}
                        />
                      </div>
                      <select
                        aria-label="Custom interval unit"
                        value={customIntervalUnit}
                        onChange={(e) => setCustomIntervalUnit(e.target.value as CustomIntervalUnit)}
                        className="h-8 rounded-lg border border-neutral-200 px-2 text-sm"
                      >
                        <option value="day">Days</option>
                        <option value="week">Weeks</option>
                        <option value="month">Months</option>
                      </select>
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} />
                    Auto-renew (repeats indefinitely)
                  </label>
                  {!autoRenew && (
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="reminder-end-date">End date</Label>
                        <Input id="reminder-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="reminder-max-occurrences"># of occurrences</Label>
                        <Input
                          id="reminder-max-occurrences"
                          type="number"
                          min="1"
                          value={maxOccurrences}
                          onChange={(e) => setMaxOccurrences(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        <SheetFooter>
          <Button onClick={handleSubmit} disabled={!isValid || submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Run ReminderForm test to verify it passes**

Run: `npx vitest run components/reminders/ReminderForm.test.tsx`
Expected: PASS

- [ ] **Step 5: Thread `onSkip` through `ReminderRow.tsx` and `RemindersListView.tsx`**

Same pattern as Task 10 Step 5:

```tsx
// components/reminders/ReminderRow.tsx — add to props and RowActionsMenu call
interface ReminderRowProps {
  reminder: Reminder;
  onToggleComplete: (id: string) => void;
  onSnooze: (id: string) => void;
  referenceDate?: Date;
  onEdit?: (reminder: Reminder) => void;
  onDelete?: (reminder: Reminder) => void;
  onSkip?: (reminder: Reminder) => void;
}

// in the RowActionsMenu JSX:
<RowActionsMenu
  label={reminder.title}
  onEdit={onEdit ? () => onEdit(reminder) : undefined}
  onDelete={onDelete ? () => onDelete(reminder) : undefined}
  onSkip={onSkip && reminder.seriesId && !reminder.completed ? () => onSkip(reminder) : undefined}
/>
```

```tsx
// components/reminders/RemindersListView.tsx — add to props interface, destructuring, and the ReminderRow render call
interface RemindersListViewProps {
  reminders: Reminder[];
  onToggleComplete: (id: string) => void;
  onSnooze: (id: string) => void;
  referenceDate?: Date;
  onEdit?: (reminder: Reminder) => void;
  onDelete?: (reminder: Reminder) => void;
  onSkip?: (reminder: Reminder) => void;
}
// thread onSkip through to <ReminderRow ... onSkip={onSkip} />
```

- [ ] **Step 6: Wire `app/(shell)/reminders/page.tsx`**

```tsx
// app/(shell)/reminders/page.tsx — inside RemindersPageContent, update handleSubmit:
async function handleSubmit(input: import('@/components/reminders/ReminderForm').ReminderFormInput) {
  if (editingReminder) {
    await updateReminder(editingReminder.id, input);
  } else if (input.series) {
    await createRecurringReminder({ title: input.title, category: input.category, dueDate: input.dueDate, priority: input.priority }, input.series);
  } else {
    await createReminder(input);
  }
}
```

Update the `useReminders()` destructure to also pull `createRecurringReminder` and
`skipCycle`, and pass `onSkip={(reminder) => skipCycle(reminder.id)}` to
`<RemindersListView />`.

- [ ] **Step 7: Write the failing RemindersPage test for skip, then verify it passes**

Add to `app/(shell)/reminders/page.test.tsx`, mirroring Task 10 Step 7's pattern (update
`useRemindersMock.mockReturnValue` calls throughout the file to also include
`createRecurringReminder: vi.fn()` and `skipCycle: vi.fn()`):

```typescript
it('calls skipCycle when Skip this cycle is chosen for a recurring reminder', async () => {
  const skipCycleMock = vi.fn().mockResolvedValue(undefined);
  useRemindersMock.mockReturnValue({
    reminders: [{ ...reminders[0], seriesId: 'series-1', cycleNumber: 1, skipped: false }],
    loading: false,
    error: null,
    refresh: vi.fn(),
    createReminder: createReminderMock,
    createRecurringReminder: vi.fn(),
    updateReminder: updateReminderMock,
    deleteReminder: deleteReminderMock,
    toggleComplete: toggleCompleteMock,
    skipCycle: skipCycleMock,
    snooze: snoozeMock,
  });
  const user = userEvent.setup();
  render(<RemindersPage />);
  await user.click(screen.getByRole('button', { name: /actions for call insurance provider/i }));
  await user.click(await screen.findByRole('menuitem', { name: /skip/i }));
  expect(skipCycleMock).toHaveBeenCalledWith('reminder-1');
});
```

Run: `npx vitest run "app/(shell)/reminders/page.test.tsx"`
Expected: PASS

- [ ] **Step 8: Run the component/page test files together, then commit**

```bash
npx vitest run components/reminders "app/(shell)/reminders"
git add components/reminders/ReminderForm.tsx components/reminders/ReminderForm.test.tsx components/reminders/ReminderRow.tsx components/reminders/RemindersListView.tsx "app/(shell)/reminders/page.tsx" "app/(shell)/reminders/page.test.tsx"
git commit -m "feat: add recurring reminder creation UI and skip-this-cycle action to Reminders"
```

---

### Task 12: Full suite verification

**Files:** none created — verification task.

- [ ] **Step 1: Run the full automated suite**

```bash
npx vitest run
npx tsc --noEmit
npx eslint .
```

Expected: all green. Fix any failures surfaced by the integration of Tasks 1–11 before
proceeding — the most likely spot is other existing test files that render
`BillsListView`/`RemindersListView`/`BillRow`/`ReminderRow` directly and construct
`Bill`/`Reminder` fixture objects by hand (they'll need `seriesId: null, cycleNumber:
null, skipped: false` added), or that call `useBills()`/`useReminders()` mocks without
the two new returned functions.

- [ ] **Step 2: Manual smoke test**

Since Supabase migration `0011` cannot be applied from this session, this step is for
the user, once the migration is applied: create a recurring bill (e.g. "Netflix",
monthly, auto-renew), mark it paid, and confirm a new row appears due next month while
the paid row remains visible in history (query `select * from bills where series_id =
'<id>' order by cycle_number` to see both). Repeat for a reminder. Try "Skip this cycle"
on an open recurring bill and confirm the skipped row's `skipped` column is `true` and a
new cycle was generated. Try a series with `auto_renew` off and a 2-occurrence
`max_occurrences`, close both cycles, and confirm no third row is generated.
