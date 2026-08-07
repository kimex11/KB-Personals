# Home Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Home tab's month-grid calendar with a priority-stacked dashboard (alerts, bills due this week, spending snapshot, recent transactions, reminders, one goal, quick actions), all backed by mock data.

**Architecture:** Seven self-contained panel components under `components/dashboard/`, each taking its data slice as props with no cross-panel coupling. Pure selector functions filter existing mock calendar events (bills/reminders) and new mock transaction/goal data. `app/(shell)/page.tsx` becomes a thin composition root that computes props once and renders panels in order.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind v4, date-fns, Vitest + React Testing Library, existing shadcn/Base UI `Button`/`Sheet` primitives.

## Global Constraints

- Mock data only — no new Supabase tables or queries this phase.
- Currency displayed as ₱ (Philippine peso), `.toFixed(2)` for line-item amounts, `.toFixed(0)` for summary totals — matches existing `EventCard`/`BudgetSummary` convention.
- Reuse existing design tokens: `bg-gold`, `text-gold`, `text-status-critical`, `bg-status-critical`, `font-serif` (Fraunces headings), default sans (Inter) — no new colors or fonts.
- Reuse existing primitives: `Button`, `Sheet`/`SheetTrigger`/`SheetContent`, `EmptyState` — don't reinvent card/sheet chrome.
- `MonthGrid` and `DayDetailPanel` (and their tests) are not modified or deleted — only unreferenced from `app/(shell)/page.tsx`.
- TDD: write the failing test before the implementation for every new file.
- Test command: `npm test` (runs `vitest run`).

---

### Task 1: Dashboard data types and mock data

**Files:**
- Create: `lib/dashboard-types.ts`
- Create: `lib/dashboard-data.ts`
- Test: `lib/dashboard-data.test.ts`

**Interfaces:**
- Produces: `Transaction { id: string; title: string; category: string; amount: number; date: string }`, `SavingsGoal { id: string; title: string; saved: number; target: number }`, `generateMockTransactions(baseDate?: Date): Transaction[]`, `mockTransactions: Transaction[]`, `mockGoal: SavingsGoal`

- [ ] **Step 1: Write `lib/dashboard-types.ts`**

```typescript
export interface Transaction {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: string; // ISO 'yyyy-MM-dd'
}

export interface SavingsGoal {
  id: string;
  title: string;
  saved: number;
  target: number;
}
```

- [ ] **Step 2: Write the failing test for `lib/dashboard-data.ts`**

```typescript
// lib/dashboard-data.test.ts
import { describe, expect, it } from 'vitest';
import { generateMockTransactions, mockGoal } from './dashboard-data';

describe('generateMockTransactions', () => {
  const base = new Date(2026, 7, 15); // 2026-08-15
  const transactions = generateMockTransactions(base);

  it('generates at least 4 transactions', () => {
    expect(transactions.length).toBeGreaterThanOrEqual(4);
  });

  it('gives every transaction a positive amount', () => {
    for (const txn of transactions) {
      expect(txn.amount).toBeGreaterThan(0);
    }
  });

  it('assigns each transaction a unique id', () => {
    const ids = transactions.map((txn) => txn.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('sorts transactions newest first', () => {
    const dates = transactions.map((txn) => txn.date);
    const sorted = [...dates].sort().reverse();
    expect(dates).toEqual(sorted);
  });

  it('dates transactions on or before the base date', () => {
    const baseStr = '2026-08-15';
    for (const txn of transactions) {
      expect(txn.date <= baseStr).toBe(true);
    }
  });
});

describe('mockGoal', () => {
  it('has a saved amount less than or equal to its target', () => {
    expect(mockGoal.saved).toBeLessThanOrEqual(mockGoal.target);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- lib/dashboard-data.test.ts`
Expected: FAIL with "Cannot find module './dashboard-data'"

- [ ] **Step 4: Write `lib/dashboard-data.ts`**

```typescript
import { addDays } from 'date-fns';
import type { Transaction, SavingsGoal } from './dashboard-types';
import { toISODateString } from './date-utils';

interface MockTransactionSeed {
  dayOffset: number;
  title: string;
  category: string;
  amount: number;
}

const TRANSACTION_SEEDS: MockTransactionSeed[] = [
  { dayOffset: -1, title: 'Grab Ride', category: 'Transport', amount: 8.5 },
  { dayOffset: -2, title: 'Grocery Run', category: 'Groceries', amount: 42.3 },
  { dayOffset: -3, title: 'Netflix', category: 'Entertainment', amount: 15.99 },
  { dayOffset: -5, title: 'Coffee Shop', category: 'Shopping', amount: 6.75 },
  { dayOffset: -6, title: 'Electric Bill Payment', category: 'Utilities', amount: 84.5 },
];

export function generateMockTransactions(baseDate: Date = new Date()): Transaction[] {
  return TRANSACTION_SEEDS.map(({ dayOffset, ...rest }, index) => ({
    id: `txn-${index}`,
    date: toISODateString(addDays(baseDate, dayOffset)),
    ...rest,
  })).sort((a, b) => (a.date < b.date ? 1 : -1));
}

export const mockTransactions: Transaction[] = generateMockTransactions();

export const mockGoal: SavingsGoal = {
  id: 'emergency-fund',
  title: 'Emergency Fund',
  saved: 3200,
  target: 6000,
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- lib/dashboard-data.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/dashboard-types.ts lib/dashboard-data.ts lib/dashboard-data.test.ts
git commit -m "feat: add dashboard mock transactions and goal data"
```

---

### Task 2: Bill/reminder selector functions and relative-date formatting

**Files:**
- Create: `lib/dashboard-selectors.ts`
- Modify: `lib/date-utils.ts`
- Test: `lib/dashboard-selectors.test.ts`
- Test: `lib/date-utils.test.ts` (append)

**Interfaces:**
- Consumes: `CalendarEvent` from `lib/types.ts` (`{ id, type, title, date, time?, amount? }`), `toISODateString(date: Date): string` from `lib/date-utils.ts`
- Produces: `getOverdueBills(events: CalendarEvent[], referenceDate?: Date): CalendarEvent[]`, `getBillsDueWithinDays(events: CalendarEvent[], days: number, referenceDate?: Date): CalendarEvent[]`, `getUpcomingReminders(events: CalendarEvent[], count: number, referenceDate?: Date): CalendarEvent[]`, `formatRelativeDate(dateStr: string, referenceDate?: Date): string`

- [ ] **Step 1: Write the failing test for selectors**

```typescript
// lib/dashboard-selectors.test.ts
import { describe, expect, it } from 'vitest';
import { getOverdueBills, getBillsDueWithinDays, getUpcomingReminders } from './dashboard-selectors';
import type { CalendarEvent } from './types';

const referenceDate = new Date(2026, 7, 15); // 2026-08-15

const events: CalendarEvent[] = [
  { id: '1', type: 'bill', title: 'Overdue Rent', date: '2026-08-10', amount: 1450 },
  { id: '2', type: 'bill', title: 'Due Today', date: '2026-08-15', amount: 50 },
  { id: '3', type: 'bill', title: 'Due In 3 Days', date: '2026-08-18', amount: 20 },
  { id: '4', type: 'bill', title: 'Due In 10 Days', date: '2026-08-25', amount: 30 },
  { id: '5', type: 'reminder', title: 'Call bank', date: '2026-08-16' },
  { id: '6', type: 'reminder', title: 'Renew passport', date: '2026-08-20' },
  { id: '7', type: 'reminder', title: 'Past reminder', date: '2026-08-01' },
  { id: '8', type: 'task', title: 'Reconcile receipts', date: '2026-08-16' },
];

describe('getOverdueBills', () => {
  it('returns only bills dated before the reference date', () => {
    const overdue = getOverdueBills(events, referenceDate);
    expect(overdue.map((e) => e.id)).toEqual(['1']);
  });
});

describe('getBillsDueWithinDays', () => {
  it('returns bills due today through N days out, sorted ascending', () => {
    const dueThisWeek = getBillsDueWithinDays(events, 7, referenceDate);
    expect(dueThisWeek.map((e) => e.id)).toEqual(['2', '3']);
  });
});

describe('getUpcomingReminders', () => {
  it('returns only future-or-today reminders, sorted ascending, capped at count', () => {
    const upcoming = getUpcomingReminders(events, 2, referenceDate);
    expect(upcoming.map((e) => e.id)).toEqual(['5', '6']);
  });

  it('excludes non-reminder event types', () => {
    const upcoming = getUpcomingReminders(events, 10, referenceDate);
    expect(upcoming.every((e) => e.type === 'reminder')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/dashboard-selectors.test.ts`
Expected: FAIL with "Cannot find module './dashboard-selectors'"

- [ ] **Step 3: Write `lib/dashboard-selectors.ts`**

```typescript
import type { CalendarEvent } from './types';
import { toISODateString } from './date-utils';
import { addDays } from 'date-fns';

export function getOverdueBills(events: CalendarEvent[], referenceDate: Date = new Date()): CalendarEvent[] {
  const todayStr = toISODateString(referenceDate);
  return events
    .filter((e) => e.type === 'bill' && e.date < todayStr)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function getBillsDueWithinDays(
  events: CalendarEvent[],
  days: number,
  referenceDate: Date = new Date()
): CalendarEvent[] {
  const todayStr = toISODateString(referenceDate);
  const endStr = toISODateString(addDays(referenceDate, days));
  return events
    .filter((e) => e.type === 'bill' && e.date >= todayStr && e.date <= endStr)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function getUpcomingReminders(
  events: CalendarEvent[],
  count: number,
  referenceDate: Date = new Date()
): CalendarEvent[] {
  const todayStr = toISODateString(referenceDate);
  return events
    .filter((e) => e.type === 'reminder' && e.date >= todayStr)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, count);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/dashboard-selectors.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write the failing test for `formatRelativeDate`, appended to `lib/date-utils.test.ts`**

Read the existing file first to append after its last test, keeping its existing tests intact. Add:

```typescript
import { formatRelativeDate } from './date-utils';

describe('formatRelativeDate', () => {
  const referenceDate = new Date(2026, 7, 15); // 2026-08-15, a Saturday

  it('returns "Today" for the reference date', () => {
    expect(formatRelativeDate('2026-08-15', referenceDate)).toBe('Today');
  });

  it('returns "Tomorrow" for one day ahead', () => {
    expect(formatRelativeDate('2026-08-16', referenceDate)).toBe('Tomorrow');
  });

  it('returns "Yesterday" for one day behind', () => {
    expect(formatRelativeDate('2026-08-14', referenceDate)).toBe('Yesterday');
  });

  it('returns a weekday name for 2-6 days ahead', () => {
    expect(formatRelativeDate('2026-08-18', referenceDate)).toBe('Tue');
  });

  it('returns "N days ago" for 2-6 days behind', () => {
    expect(formatRelativeDate('2026-08-12', referenceDate)).toBe('3 days ago');
  });

  it('returns a month/day for anything further out', () => {
    expect(formatRelativeDate('2026-08-25', referenceDate)).toBe('Aug 25');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- lib/date-utils.test.ts`
Expected: FAIL with "formatRelativeDate is not a function" (or import error)

- [ ] **Step 7: Add `formatRelativeDate` to `lib/date-utils.ts`**

Append to the existing file (keep all existing exports untouched), adding `parseISO` and `differenceInCalendarDays` to the existing `date-fns` import:

```typescript
import {
  startOfMonth,
  startOfWeek,
  addDays,
  eachDayOfInterval,
  isSameMonth,
  format,
  parseISO,
  differenceInCalendarDays,
} from 'date-fns';
```

And add at the end of the file:

```typescript
export function formatRelativeDate(dateStr: string, referenceDate: Date = new Date()): string {
  const target = parseISO(dateStr);
  const diffDays = differenceInCalendarDays(target, referenceDate);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 1 && diffDays <= 6) return format(target, 'EEE');
  if (diffDays < -1 && diffDays >= -6) return `${Math.abs(diffDays)} days ago`;
  return format(target, 'MMM d');
}
```

- [ ] **Step 8: Run both test files to verify they pass**

Run: `npm test -- lib/date-utils.test.ts lib/dashboard-selectors.test.ts`
Expected: PASS (all tests)

- [ ] **Step 9: Commit**

```bash
git add lib/dashboard-selectors.ts lib/dashboard-selectors.test.ts lib/date-utils.ts lib/date-utils.test.ts
git commit -m "feat: add dashboard bill/reminder selectors and relative-date formatting"
```

---

### Task 3: AlertsBanner component

**Files:**
- Create: `components/dashboard/AlertsBanner.tsx`
- Test: `components/dashboard/AlertsBanner.test.tsx`

**Interfaces:**
- Consumes: `CalendarEvent` from `lib/types.ts`
- Produces: `AlertsBanner({ overdueBills: CalendarEvent[], referenceDate?: Date })` — renders `null` when `overdueBills` is empty; otherwise a `data-testid="alerts-banner"` card with one `data-testid="overdue-bill-row"` per bill.

- [ ] **Step 1: Write the failing test**

```typescript
// components/dashboard/AlertsBanner.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AlertsBanner } from './AlertsBanner';
import type { CalendarEvent } from '@/lib/types';

const referenceDate = new Date(2026, 7, 15);

describe('AlertsBanner', () => {
  it('renders nothing when there are no overdue bills', () => {
    const { container } = render(<AlertsBanner overdueBills={[]} referenceDate={referenceDate} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders one row per overdue bill with title and days-overdue count', () => {
    const overdueBills: CalendarEvent[] = [
      { id: '1', type: 'bill', title: 'Rent', date: '2026-08-10', amount: 1450 },
      { id: '2', type: 'bill', title: 'Internet', date: '2026-08-14', amount: 59.99 },
    ];
    render(<AlertsBanner overdueBills={overdueBills} referenceDate={referenceDate} />);
    const rows = screen.getAllByTestId('overdue-bill-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Rent');
    expect(rows[0]).toHaveTextContent('5 days overdue');
    expect(rows[1]).toHaveTextContent('1 day overdue');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/dashboard/AlertsBanner.test.tsx`
Expected: FAIL with "Cannot find module './AlertsBanner'"

- [ ] **Step 3: Write `components/dashboard/AlertsBanner.tsx`**

```typescript
import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { CalendarEvent } from '@/lib/types';

interface AlertsBannerProps {
  overdueBills: CalendarEvent[];
  referenceDate?: Date;
}

export function AlertsBanner({ overdueBills, referenceDate = new Date() }: AlertsBannerProps) {
  if (overdueBills.length === 0) return null;

  return (
    <div
      data-testid="alerts-banner"
      className="flex flex-col gap-2 rounded-2xl border border-status-critical bg-status-critical/10 p-4"
    >
      <p className="text-sm font-medium text-status-critical">Overdue</p>
      <div className="flex flex-col gap-2">
        {overdueBills.map((bill) => {
          const daysOverdue = differenceInCalendarDays(referenceDate, parseISO(bill.date));
          return (
            <div key={bill.id} data-testid="overdue-bill-row" className="flex items-center justify-between">
              <span className="text-sm text-neutral-900">{bill.title}</span>
              <span className="text-xs text-status-critical">
                {daysOverdue} {daysOverdue === 1 ? 'day' : 'days'} overdue
                {bill.amount !== undefined ? ` · ₱${bill.amount.toFixed(2)}` : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- components/dashboard/AlertsBanner.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/AlertsBanner.tsx components/dashboard/AlertsBanner.test.tsx
git commit -m "feat: add dashboard AlertsBanner component"
```

---

### Task 4: WeeklyBillsPanel component

**Files:**
- Create: `components/dashboard/WeeklyBillsPanel.tsx`
- Test: `components/dashboard/WeeklyBillsPanel.test.tsx`

**Interfaces:**
- Consumes: `CalendarEvent` from `lib/types.ts`, `formatRelativeDate` from `lib/date-utils.ts`, `EmptyState` from `components/shared/EmptyState.tsx`
- Produces: `WeeklyBillsPanel({ bills: CalendarEvent[], referenceDate?: Date })` — `data-testid="weekly-bills-panel"`, one `data-testid="weekly-bill-row"` per bill each with a `data-testid="mark-paid-button"` that replaces itself with "Coming soon" text on click.

- [ ] **Step 1: Write the failing test**

```typescript
// components/dashboard/WeeklyBillsPanel.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WeeklyBillsPanel } from './WeeklyBillsPanel';
import type { CalendarEvent } from '@/lib/types';

const referenceDate = new Date(2026, 7, 15);

describe('WeeklyBillsPanel', () => {
  it('shows an empty state when there are no bills due this week', () => {
    render(<WeeklyBillsPanel bills={[]} referenceDate={referenceDate} />);
    expect(screen.getByTestId('empty-state')).toHaveTextContent('No bills due this week.');
  });

  it('renders one row per bill with title, relative date, and amount', () => {
    const bills: CalendarEvent[] = [
      { id: '1', type: 'bill', title: 'Internet Bill', date: '2026-08-15', amount: 59.99 },
    ];
    render(<WeeklyBillsPanel bills={bills} referenceDate={referenceDate} />);
    const row = screen.getByTestId('weekly-bill-row');
    expect(row).toHaveTextContent('Internet Bill');
    expect(row).toHaveTextContent('Today');
    expect(row).toHaveTextContent('₱59.99');
  });

  it('replaces the Mark as Paid button with "Coming soon" when clicked', () => {
    const bills: CalendarEvent[] = [{ id: '1', type: 'bill', title: 'Rent', date: '2026-08-15', amount: 1450 }];
    render(<WeeklyBillsPanel bills={bills} referenceDate={referenceDate} />);
    fireEvent.click(screen.getByTestId('mark-paid-button'));
    expect(screen.queryByTestId('mark-paid-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('weekly-bill-row')).toHaveTextContent('Coming soon');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/dashboard/WeeklyBillsPanel.test.tsx`
Expected: FAIL with "Cannot find module './WeeklyBillsPanel'"

- [ ] **Step 3: Write `components/dashboard/WeeklyBillsPanel.tsx`**

```typescript
'use client';

import { useState } from 'react';
import type { CalendarEvent } from '@/lib/types';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatRelativeDate } from '@/lib/date-utils';

interface WeeklyBillsPanelProps {
  bills: CalendarEvent[];
  referenceDate?: Date;
}

export function WeeklyBillsPanel({ bills, referenceDate = new Date() }: WeeklyBillsPanelProps) {
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set());

  return (
    <div data-testid="weekly-bills-panel" className="flex flex-col gap-3">
      <h2 className="font-serif text-lg text-neutral-900">This Week&apos;s Bills</h2>
      {bills.length === 0 ? (
        <EmptyState message="No bills due this week." />
      ) : (
        <div className="flex flex-col gap-2">
          {bills.map((bill) => (
            <div
              key={bill.id}
              data-testid="weekly-bill-row"
              className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-neutral-900">{bill.title}</p>
                <p className="text-xs text-neutral-500">
                  {formatRelativeDate(bill.date, referenceDate)}
                  {bill.amount !== undefined ? ` · ₱${bill.amount.toFixed(2)}` : ''}
                </p>
              </div>
              {paidIds.has(bill.id) ? (
                <span className="text-xs text-neutral-400">Coming soon</span>
              ) : (
                <button
                  type="button"
                  data-testid="mark-paid-button"
                  className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-700"
                  onClick={() => setPaidIds((prev) => new Set(prev).add(bill.id))}
                >
                  Mark as Paid
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- components/dashboard/WeeklyBillsPanel.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/WeeklyBillsPanel.tsx components/dashboard/WeeklyBillsPanel.test.tsx
git commit -m "feat: add dashboard WeeklyBillsPanel component"
```

---

### Task 5: SpendingSnapshot component

**Files:**
- Create: `components/dashboard/SpendingSnapshot.tsx`
- Test: `components/dashboard/SpendingSnapshot.test.tsx`

**Interfaces:**
- Produces: `SpendingSnapshot({ budgeted: number, spent: number, remaining: number })` — `data-testid="spending-snapshot"`, `data-testid="spending-progress-fill"` with `style.width` proportional to `spent/budgeted` (capped 100%), a link to `/budget`.

- [ ] **Step 1: Write the failing test**

```typescript
// components/dashboard/SpendingSnapshot.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpendingSnapshot } from './SpendingSnapshot';

describe('SpendingSnapshot', () => {
  it('shows spent-of-budgeted text and remaining amount', () => {
    render(<SpendingSnapshot budgeted={3000} spent={1800} remaining={1200} />);
    expect(screen.getByTestId('spending-snapshot')).toHaveTextContent('₱1800 of ₱3000 spent');
    expect(screen.getByTestId('spending-snapshot')).toHaveTextContent('₱1200 remaining');
  });

  it('sets the progress fill width proportional to spent/budgeted', () => {
    render(<SpendingSnapshot budgeted={2000} spent={1000} remaining={1000} />);
    expect(screen.getByTestId('spending-progress-fill')).toHaveStyle({ width: '50%' });
  });

  it('caps the progress fill at 100% when overspent', () => {
    render(<SpendingSnapshot budgeted={1000} spent={1500} remaining={-500} />);
    expect(screen.getByTestId('spending-progress-fill')).toHaveStyle({ width: '100%' });
  });

  it('shows the remaining amount in the critical color when negative', () => {
    render(<SpendingSnapshot budgeted={1000} spent={1500} remaining={-500} />);
    expect(screen.getByTestId('spending-progress-fill').className).toContain('bg-status-critical');
  });

  it('links to the Budget tab', () => {
    render(<SpendingSnapshot budgeted={1000} spent={500} remaining={500} />);
    expect(screen.getByRole('link', { name: 'View Budget' })).toHaveAttribute('href', '/budget');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/dashboard/SpendingSnapshot.test.tsx`
Expected: FAIL with "Cannot find module './SpendingSnapshot'"

- [ ] **Step 3: Write `components/dashboard/SpendingSnapshot.tsx`**

```typescript
import Link from 'next/link';

interface SpendingSnapshotProps {
  budgeted: number;
  spent: number;
  remaining: number;
}

export function SpendingSnapshot({ budgeted, spent, remaining }: SpendingSnapshotProps) {
  const progress = budgeted > 0 ? Math.min(spent / budgeted, 1) * 100 : 0;

  return (
    <div
      data-testid="spending-snapshot"
      className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg text-neutral-900">Spending Snapshot</h2>
        <Link href="/budget" className="text-xs font-medium text-gold">
          View Budget
        </Link>
      </div>
      <p className="text-sm text-neutral-500">
        ₱{spent.toFixed(0)} of ₱{budgeted.toFixed(0)} spent
      </p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          data-testid="spending-progress-fill"
          className={`h-full rounded-full ${remaining < 0 ? 'bg-status-critical' : 'bg-gold'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className={`text-xs ${remaining < 0 ? 'text-status-critical' : 'text-neutral-500'}`}>
        ₱{remaining.toFixed(0)} remaining
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- components/dashboard/SpendingSnapshot.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/SpendingSnapshot.tsx components/dashboard/SpendingSnapshot.test.tsx
git commit -m "feat: add dashboard SpendingSnapshot component"
```

---

### Task 6: RecentTransactionsPanel component

**Files:**
- Create: `components/dashboard/RecentTransactionsPanel.tsx`
- Test: `components/dashboard/RecentTransactionsPanel.test.tsx`

**Interfaces:**
- Consumes: `Transaction` from `lib/dashboard-types.ts`, `formatRelativeDate` from `lib/date-utils.ts`, `EmptyState` from `components/shared/EmptyState.tsx`
- Produces: `RecentTransactionsPanel({ transactions: Transaction[], referenceDate?: Date })` — `data-testid="recent-transactions-panel"`, one `data-testid="transaction-row"` per transaction.

- [ ] **Step 1: Write the failing test**

```typescript
// components/dashboard/RecentTransactionsPanel.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecentTransactionsPanel } from './RecentTransactionsPanel';
import type { Transaction } from '@/lib/dashboard-types';

const referenceDate = new Date(2026, 7, 15);

describe('RecentTransactionsPanel', () => {
  it('shows an empty state when there are no transactions', () => {
    render(<RecentTransactionsPanel transactions={[]} referenceDate={referenceDate} />);
    expect(screen.getByTestId('empty-state')).toHaveTextContent('No recent transactions.');
  });

  it('renders one row per transaction with title, category, relative date, and amount', () => {
    const transactions: Transaction[] = [
      { id: 't1', title: 'Grab Ride', category: 'Transport', amount: 8.5, date: '2026-08-14' },
    ];
    render(<RecentTransactionsPanel transactions={transactions} referenceDate={referenceDate} />);
    const row = screen.getByTestId('transaction-row');
    expect(row).toHaveTextContent('Grab Ride');
    expect(row).toHaveTextContent('Transport');
    expect(row).toHaveTextContent('Yesterday');
    expect(row).toHaveTextContent('₱8.50');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/dashboard/RecentTransactionsPanel.test.tsx`
Expected: FAIL with "Cannot find module './RecentTransactionsPanel'"

- [ ] **Step 3: Write `components/dashboard/RecentTransactionsPanel.tsx`**

```typescript
import type { Transaction } from '@/lib/dashboard-types';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatRelativeDate } from '@/lib/date-utils';

interface RecentTransactionsPanelProps {
  transactions: Transaction[];
  referenceDate?: Date;
}

export function RecentTransactionsPanel({ transactions, referenceDate = new Date() }: RecentTransactionsPanelProps) {
  return (
    <div data-testid="recent-transactions-panel" className="flex flex-col gap-3">
      <h2 className="font-serif text-lg text-neutral-900">Recent Transactions</h2>
      {transactions.length === 0 ? (
        <EmptyState message="No recent transactions." />
      ) : (
        <div className="flex flex-col gap-2">
          {transactions.map((txn) => (
            <div
              key={txn.id}
              data-testid="transaction-row"
              className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-neutral-900">{txn.title}</p>
                <p className="text-xs text-neutral-500">
                  {txn.category} · {formatRelativeDate(txn.date, referenceDate)}
                </p>
              </div>
              <span className="font-serif text-sm text-neutral-900">₱{txn.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- components/dashboard/RecentTransactionsPanel.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/RecentTransactionsPanel.tsx components/dashboard/RecentTransactionsPanel.test.tsx
git commit -m "feat: add dashboard RecentTransactionsPanel component"
```

---

### Task 7: RemindersPanel component

**Files:**
- Create: `components/dashboard/RemindersPanel.tsx`
- Test: `components/dashboard/RemindersPanel.test.tsx`

**Interfaces:**
- Consumes: `CalendarEvent` from `lib/types.ts`, `formatRelativeDate` from `lib/date-utils.ts`, `EmptyState` from `components/shared/EmptyState.tsx`
- Produces: `RemindersPanel({ reminders: CalendarEvent[], referenceDate?: Date })` — `data-testid="reminders-panel"`, one `data-testid="reminder-row"` per reminder.

- [ ] **Step 1: Write the failing test**

```typescript
// components/dashboard/RemindersPanel.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RemindersPanel } from './RemindersPanel';
import type { CalendarEvent } from '@/lib/types';

const referenceDate = new Date(2026, 7, 15);

describe('RemindersPanel', () => {
  it('shows an empty state when there are no reminders', () => {
    render(<RemindersPanel reminders={[]} referenceDate={referenceDate} />);
    expect(screen.getByTestId('empty-state')).toHaveTextContent('No upcoming reminders.');
  });

  it('renders one row per reminder with title and relative date', () => {
    const reminders: CalendarEvent[] = [
      { id: 'r1', type: 'reminder', title: 'Call insurance provider', date: '2026-08-16' },
    ];
    render(<RemindersPanel reminders={reminders} referenceDate={referenceDate} />);
    const row = screen.getByTestId('reminder-row');
    expect(row).toHaveTextContent('Call insurance provider');
    expect(row).toHaveTextContent('Tomorrow');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/dashboard/RemindersPanel.test.tsx`
Expected: FAIL with "Cannot find module './RemindersPanel'"

- [ ] **Step 3: Write `components/dashboard/RemindersPanel.tsx`**

```typescript
import type { CalendarEvent } from '@/lib/types';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatRelativeDate } from '@/lib/date-utils';

interface RemindersPanelProps {
  reminders: CalendarEvent[];
  referenceDate?: Date;
}

export function RemindersPanel({ reminders, referenceDate = new Date() }: RemindersPanelProps) {
  return (
    <div data-testid="reminders-panel" className="flex flex-col gap-3">
      <h2 className="font-serif text-lg text-neutral-900">Reminders</h2>
      {reminders.length === 0 ? (
        <EmptyState message="No upcoming reminders." />
      ) : (
        <div className="flex flex-col gap-2">
          {reminders.map((reminder) => (
            <div
              key={reminder.id}
              data-testid="reminder-row"
              className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3"
            >
              <span className="text-sm font-medium text-neutral-900">{reminder.title}</span>
              <span className="text-xs text-neutral-500">{formatRelativeDate(reminder.date, referenceDate)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- components/dashboard/RemindersPanel.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/RemindersPanel.tsx components/dashboard/RemindersPanel.test.tsx
git commit -m "feat: add dashboard RemindersPanel component"
```

---

### Task 8: GoalProgressPanel component

**Files:**
- Create: `components/dashboard/GoalProgressPanel.tsx`
- Test: `components/dashboard/GoalProgressPanel.test.tsx`

**Interfaces:**
- Consumes: `SavingsGoal` from `lib/dashboard-types.ts`
- Produces: `GoalProgressPanel({ goal: SavingsGoal })` — `data-testid="goal-progress-panel"`, `data-testid="goal-progress-fill"` with `style.width` proportional to `saved/target`.

- [ ] **Step 1: Write the failing test**

```typescript
// components/dashboard/GoalProgressPanel.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GoalProgressPanel } from './GoalProgressPanel';
import type { SavingsGoal } from '@/lib/dashboard-types';

const goal: SavingsGoal = { id: 'g1', title: 'Emergency Fund', saved: 3000, target: 6000 };

describe('GoalProgressPanel', () => {
  it('shows the goal title and saved-of-target amounts', () => {
    render(<GoalProgressPanel goal={goal} />);
    expect(screen.getByTestId('goal-progress-panel')).toHaveTextContent('Emergency Fund');
    expect(screen.getByTestId('goal-progress-panel')).toHaveTextContent('₱3000 of ₱6000 saved');
  });

  it('sets the progress fill width proportional to saved/target', () => {
    render(<GoalProgressPanel goal={goal} />);
    expect(screen.getByTestId('goal-progress-fill')).toHaveStyle({ width: '50%' });
  });

  it('caps the progress fill at 100% when saved exceeds target', () => {
    const overGoal: SavingsGoal = { id: 'g2', title: 'Trip Fund', saved: 700, target: 500 };
    render(<GoalProgressPanel goal={overGoal} />);
    expect(screen.getByTestId('goal-progress-fill')).toHaveStyle({ width: '100%' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/dashboard/GoalProgressPanel.test.tsx`
Expected: FAIL with "Cannot find module './GoalProgressPanel'"

- [ ] **Step 3: Write `components/dashboard/GoalProgressPanel.tsx`**

```typescript
import type { SavingsGoal } from '@/lib/dashboard-types';

export function GoalProgressPanel({ goal }: { goal: SavingsGoal }) {
  const progress = goal.target > 0 ? Math.min(goal.saved / goal.target, 1) * 100 : 0;

  return (
    <div
      data-testid="goal-progress-panel"
      className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-4"
    >
      <h2 className="font-serif text-lg text-neutral-900">{goal.title}</h2>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          data-testid="goal-progress-fill"
          className="h-full rounded-full bg-gold"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs text-neutral-500">
        ₱{goal.saved.toFixed(0)} of ₱{goal.target.toFixed(0)} saved
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- components/dashboard/GoalProgressPanel.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/GoalProgressPanel.tsx components/dashboard/GoalProgressPanel.test.tsx
git commit -m "feat: add dashboard GoalProgressPanel component"
```

---

### Task 9: QuickActionsRow component

**Files:**
- Create: `components/dashboard/QuickActionsRow.tsx`
- Test: `components/dashboard/QuickActionsRow.test.tsx`

**Interfaces:**
- Consumes: `Button` from `components/ui/button.tsx`, `Sheet`/`SheetTrigger`/`SheetContent` from `components/ui/sheet.tsx`
- Produces: `QuickActionsRow()` — no props, `data-testid="quick-actions-row"`, five `data-testid="quick-action-{id}"` trigger buttons (`bill`, `expense`, `reminder`, `receipt`, `transaction`), each opening a `data-testid="quick-action-sheet-{id}"` sheet containing "Coming soon".

- [ ] **Step 1: Write the failing test**

```typescript
// components/dashboard/QuickActionsRow.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuickActionsRow } from './QuickActionsRow';

describe('QuickActionsRow', () => {
  it('renders all five quick action buttons', () => {
    render(<QuickActionsRow />);
    expect(screen.getByTestId('quick-action-bill')).toBeInTheDocument();
    expect(screen.getByTestId('quick-action-expense')).toBeInTheDocument();
    expect(screen.getByTestId('quick-action-reminder')).toBeInTheDocument();
    expect(screen.getByTestId('quick-action-receipt')).toBeInTheDocument();
    expect(screen.getByTestId('quick-action-transaction')).toBeInTheDocument();
  });

  it('opens a "Coming soon" sheet when a quick action is tapped', () => {
    render(<QuickActionsRow />);
    fireEvent.click(screen.getByTestId('quick-action-bill'));
    expect(screen.getByTestId('quick-action-sheet-bill')).toHaveTextContent('Coming soon');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/dashboard/QuickActionsRow.test.tsx`
Expected: FAIL with "Cannot find module './QuickActionsRow'"

- [ ] **Step 3: Write `components/dashboard/QuickActionsRow.tsx`**

```typescript
'use client';

import { Receipt, Plus, Bell, Camera, ArrowLeftRight } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

const ACTIONS = [
  { id: 'bill', label: 'Add Bill', icon: Receipt },
  { id: 'expense', label: 'Add Expense', icon: Plus },
  { id: 'reminder', label: 'Add Reminder', icon: Bell },
  { id: 'receipt', label: 'Add Receipt', icon: Camera },
  { id: 'transaction', label: 'Add Transaction', icon: ArrowLeftRight },
] as const;

export function QuickActionsRow() {
  return (
    <div data-testid="quick-actions-row" className="grid grid-cols-5 gap-2">
      {ACTIONS.map(({ id, label, icon: Icon }) => (
        <Sheet key={id}>
          <SheetTrigger
            render={
              <Button
                data-testid={`quick-action-${id}`}
                aria-label={label}
                variant="ghost"
                className="flex h-auto w-auto flex-col items-center gap-1 rounded-2xl border border-neutral-200 bg-white px-2 py-3 text-neutral-700"
              />
            }
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px]">{label}</span>
          </SheetTrigger>
          <SheetContent side="bottom" data-testid={`quick-action-sheet-${id}`}>
            <p className="py-8 text-center text-neutral-500">Coming soon</p>
          </SheetContent>
        </Sheet>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- components/dashboard/QuickActionsRow.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/QuickActionsRow.tsx components/dashboard/QuickActionsRow.test.tsx
git commit -m "feat: add dashboard QuickActionsRow component"
```

---

### Task 10: Compose the dashboard into the Home page

**Files:**
- Modify: `app/(shell)/page.tsx` (full rewrite)
- Modify: `app/(shell)/page.test.tsx` (full rewrite)

**Interfaces:**
- Consumes: `useCalendarEvents` from `lib/use-calendar-events.ts` (`{ events: CalendarEvent[] }`), `useBudget` from `lib/use-budget.ts` (`{ totals: BudgetTotals }`), `mockTransactions`/`mockGoal` from `lib/dashboard-data.ts`, `getOverdueBills`/`getBillsDueWithinDays`/`getUpcomingReminders` from `lib/dashboard-selectors.ts`, all seven panel components from Tasks 3-9.
- Produces: `HomePage()` default export — `data-testid="home-page"` composing panels in order: `AlertsBanner`, `WeeklyBillsPanel`, `SpendingSnapshot`, `RecentTransactionsPanel`, `RemindersPanel`, `GoalProgressPanel`, `QuickActionsRow`.

This task replaces the calendar-based Home page entirely. `MonthGrid` and `DayDetailPanel` are not imported here anymore, but their own component files and tests are untouched — they simply become unreferenced from this page.

- [ ] **Step 1: Write the failing test for the new Home page**

```typescript
// app/(shell)/page.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from './page';
import type { CalendarEvent } from '@/lib/types';

const mockEvents: CalendarEvent[] = [
  { id: 'overdue-1', type: 'bill', title: 'Overdue Rent', date: '2026-08-01', amount: 1450 },
  { id: 'due-1', type: 'bill', title: 'Internet Bill', date: '2026-08-15', amount: 59.99 },
  { id: 'reminder-1', type: 'reminder', title: 'Call insurance provider', date: '2026-08-16' },
];

vi.mock('@/lib/use-calendar-events', () => ({
  useCalendarEvents: () => ({ events: mockEvents, getEventsForDate: () => [] }),
}));

vi.mock('@/lib/use-budget', () => ({
  useBudget: () => ({
    categories: [],
    totals: { budgeted: 3000, spent: 1800, remaining: 1200 },
  }),
}));

describe('HomePage', () => {
  it('renders the alerts banner when there are overdue bills', () => {
    render(<HomePage />);
    expect(screen.getByTestId('alerts-banner')).toBeInTheDocument();
  });

  it('renders the weekly bills panel, spending snapshot, transactions, reminders, goal, and quick actions', () => {
    render(<HomePage />);
    expect(screen.getByTestId('weekly-bills-panel')).toBeInTheDocument();
    expect(screen.getByTestId('spending-snapshot')).toBeInTheDocument();
    expect(screen.getByTestId('recent-transactions-panel')).toBeInTheDocument();
    expect(screen.getByTestId('reminders-panel')).toBeInTheDocument();
    expect(screen.getByTestId('goal-progress-panel')).toBeInTheDocument();
    expect(screen.getByTestId('quick-actions-row')).toBeInTheDocument();
  });

  it('does not render the calendar month grid', () => {
    render(<HomePage />);
    expect(screen.queryByTestId('month-grid')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- "app/(shell)/page.test.tsx"`
Expected: FAIL (old page.tsx renders `month-grid`, not the new panels; `alerts-banner`/`weekly-bills-panel`/etc. not found)

- [ ] **Step 3: Write `app/(shell)/page.tsx`**

```typescript
'use client';

import { useCalendarEvents } from '@/lib/use-calendar-events';
import { useBudget } from '@/lib/use-budget';
import { mockTransactions, mockGoal } from '@/lib/dashboard-data';
import { getOverdueBills, getBillsDueWithinDays, getUpcomingReminders } from '@/lib/dashboard-selectors';
import { AlertsBanner } from '@/components/dashboard/AlertsBanner';
import { WeeklyBillsPanel } from '@/components/dashboard/WeeklyBillsPanel';
import { SpendingSnapshot } from '@/components/dashboard/SpendingSnapshot';
import { RecentTransactionsPanel } from '@/components/dashboard/RecentTransactionsPanel';
import { RemindersPanel } from '@/components/dashboard/RemindersPanel';
import { GoalProgressPanel } from '@/components/dashboard/GoalProgressPanel';
import { QuickActionsRow } from '@/components/dashboard/QuickActionsRow';

export default function HomePage() {
  const { events } = useCalendarEvents();
  const { totals } = useBudget();

  const overdueBills = getOverdueBills(events);
  const weeklyBills = getBillsDueWithinDays(events, 7);
  const upcomingReminders = getUpcomingReminders(events, 3);

  return (
    <div data-testid="home-page" className="flex flex-col gap-6 px-4 pb-24 pt-4">
      <AlertsBanner overdueBills={overdueBills} />
      <WeeklyBillsPanel bills={weeklyBills} />
      <SpendingSnapshot budgeted={totals.budgeted} spent={totals.spent} remaining={totals.remaining} />
      <RecentTransactionsPanel transactions={mockTransactions} />
      <RemindersPanel reminders={upcomingReminders} />
      <GoalProgressPanel goal={mockGoal} />
      <QuickActionsRow />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- "app/(shell)/page.test.tsx"`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full test suite to confirm nothing else broke**

Run: `npm test`
Expected: PASS — all suites, including untouched `components/calendar/*.test.tsx` (still passing on their own, just no longer exercised via the Home page) and `app/(shell)/layout.test.tsx`.

- [ ] **Step 6: Run typecheck and lint**

Run: `npx tsc --noEmit && npx eslint .`
Expected: no errors. If `useCalendarEvents` doesn't already export `events`, this step will surface it — it does (see `lib/use-calendar-events.ts:8-9,25`), so no changes needed there.

- [ ] **Step 7: Commit**

```bash
git add "app/(shell)/page.tsx" "app/(shell)/page.test.tsx"
git commit -m "feat: replace Home calendar with dashboard panel composition"
```

---

### Task 11: In-browser visual verification

**Files:** none (verification only, no code changes)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (background)

- [ ] **Step 2: Use the playwright-skill (or agent-browser) to open the app at mobile width (390×844) and screenshot the Home tab**

Verify:
- Alerts banner appears (mock data seeds an overdue bill via `EVENT_SEEDS`'s past-dated entries relative to "today" — confirm at least one shows; if the current date makes all seeded bills future-dated, note this as expected empty-state behavior, not a bug)
- This Week's Bills, Spending Snapshot, Recent Transactions, Reminders, Goal Progress, Quick Actions all render in order, no layout overflow at 390px width
- Tapping a Quick Action opens its "Coming soon" sheet and closes cleanly
- Tapping "Mark as Paid" on a bill row swaps it for "Coming soon" text
- "View Budget" link navigates to `/budget` and back-navigation returns to Home
- Bottom tab bar and header chrome still render correctly (unaffected by this change)

- [ ] **Step 3: Screenshot at desktop width (1280×800) to confirm the phone-width shell still constrains the dashboard correctly (same invariant Phase 1's whole-branch review caught)**

- [ ] **Step 4: Report findings**

If any visual issue is found, fix it inline (it's a small styling change, not a new task) and re-screenshot. If everything checks out, this task is done — no commit needed since no code changed.

---

## Summary

After all tasks: Home tab shows a priority-stacked dashboard (alerts → bills due → spending → transactions → reminders → goal → quick actions), all mock-data-backed, calendar components preserved but unrendered, full test suite green, visually verified at mobile and desktop widths.
