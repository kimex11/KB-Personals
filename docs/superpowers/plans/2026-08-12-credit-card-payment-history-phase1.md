# Credit Card Payment History — Phase 1 (schema, repository, selectors, hook) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the data layer for Credit Card Payment History — the `credit_card_payments` table, the repository functions that read/write it, pure selectors for the summary stats, and the hook the UI (Phase 2) will consume.

**Architecture:** Per the design spec (`docs/superpowers/specs/2026-08-12-credit-card-payment-history-design.md`), `recordCardPayment` fetches the card's current `statement_balance` (the "before" value), computes the "after" value, **inserts the payment ledger row first**, then updates `credit_card_dues.statement_balance` — in that order, so a failure after the insert leaves an unreflected-but-present audit trail rather than a balance change with no record. It then fires `logActivity` (fire-and-forget) reusing the existing `update` action on `credit_card_due` — no new `AuditAction` enum value. `lib/use-card-payments.ts` follows the exact `runMutation`/`refresh` shape already used by `lib/use-accounts.ts` and `lib/use-categories.ts`.

**Tech Stack:** TypeScript, Supabase Postgres + RLS, vitest.

## Global Constraints

- No `update`/`delete` RLS policy on `credit_card_payments` — append-only, same reasoning as `audit_log`.
- `recordCardPayment` must insert the payment row before updating the card's balance, never the reverse — this ordering is itself worth a test (Task 2, Step 1).
- This migration (`0014_credit_card_payments.sql`) cannot be applied from this environment — flag it to the user as a manual `supabase db push` step, same as every migration since 0009.

---

### Task 1: `credit_card_payments` table migration

**Files:**
- Create: `supabase/migrations/0014_credit_card_payments.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0014_credit_card_payments.sql`:

```sql
create table public.credit_card_payments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.credit_card_dues(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  balance_before numeric(12, 2) not null,
  balance_after numeric(12, 2) not null,
  paid_at timestamptz not null default now(),
  method text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.credit_card_payments enable row level security;

create policy "Authenticated users can view credit card payments"
  on public.credit_card_payments for select to authenticated using (true);
create policy "Authenticated users can insert credit card payments"
  on public.credit_card_payments for insert to authenticated with check (true);

create index credit_card_payments_card_id_idx on public.credit_card_payments(card_id);
create index credit_card_payments_paid_at_idx on public.credit_card_payments(paid_at desc);
```

No `update`/`delete` policy on purpose — see Global Constraints.

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0014_credit_card_payments.sql
git commit -m "feat: add credit_card_payments table migration"
```

Flag to the user: this migration needs `supabase db push` before payment recording will work against the live database.

---

### Task 2: `lib/credit-card-payments-repository.ts`

**Files:**
- Create: `lib/credit-card-payments-repository.ts`
- Create: `lib/credit-card-payments-repository.test.ts`

**Interfaces:**
- Consumes: `createClient` from `./supabase/client`; `logActivity` from `./audit-log-repository`.
- Produces:
  - `interface CreditCardPayment { id: string; cardId: string; amount: number; balanceBefore: number; balanceAfter: number; paidAt: string; method: string | null; notes: string | null; }`
  - `interface RecordCardPaymentInput { amount: number; paidAt: string; method?: string | null; notes?: string | null; }`
  - `listPaymentsForCard(cardId: string): Promise<CreditCardPayment[]>` — newest `paidAt` first.
  - `recordCardPayment(cardId: string, input: RecordCardPaymentInput): Promise<CreditCardPayment>`
  - Consumed by `lib/use-card-payments.ts` (Task 4).

- [ ] **Step 1: Write the failing tests**

Create `lib/credit-card-payments-repository.test.ts`:

```ts
import { describe, expect, it, vi, afterEach } from 'vitest';

const selectSingleMock = vi.fn();
const updateEqMock = vi.fn();
const insertSelectSingleMock = vi.fn();
const listOrderMock = vi.fn();
const logActivityMock = vi.fn().mockResolvedValue(undefined);

vi.mock('./supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'credit_card_dues') {
        return {
          select: () => ({ eq: () => ({ single: selectSingleMock }) }),
          update: () => ({ eq: updateEqMock }),
        };
      }
      if (table === 'credit_card_payments') {
        return {
          select: () => ({ eq: () => ({ order: listOrderMock }) }),
          insert: () => ({ select: () => ({ single: insertSelectSingleMock }) }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

vi.mock('./audit-log-repository', () => ({ logActivity: logActivityMock }));

import { listPaymentsForCard, recordCardPayment } from './credit-card-payments-repository';

afterEach(() => {
  vi.clearAllMocks();
});

const paymentRow = {
  id: 'pay-1',
  card_id: 'card-1',
  amount: 300,
  balance_before: 842.5,
  balance_after: 542.5,
  paid_at: '2026-08-10T10:00:00.000Z',
  method: 'Bank transfer',
  notes: null,
};

describe('listPaymentsForCard', () => {
  it('returns payments for the card, mapped to camelCase', async () => {
    listOrderMock.mockResolvedValue({ data: [paymentRow], error: null });

    const result = await listPaymentsForCard('card-1');

    expect(result).toEqual([
      { id: 'pay-1', cardId: 'card-1', amount: 300, balanceBefore: 842.5, balanceAfter: 542.5, paidAt: '2026-08-10T10:00:00.000Z', method: 'Bank transfer', notes: null },
    ]);
  });

  it('throws on error', async () => {
    listOrderMock.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(listPaymentsForCard('card-1')).rejects.toThrow('boom');
  });
});

describe('recordCardPayment', () => {
  it('computes balanceAfter from the card\'s current balance, inserts the payment, then updates the card', async () => {
    selectSingleMock.mockResolvedValue({ data: { card_name: 'Visa Platinum', statement_balance: 842.5 }, error: null });
    insertSelectSingleMock.mockResolvedValue({ data: paymentRow, error: null });
    updateEqMock.mockResolvedValue({ error: null });

    const result = await recordCardPayment('card-1', { amount: 300, paidAt: '2026-08-10T10:00:00.000Z', method: 'Bank transfer' });

    expect(result).toEqual({
      id: 'pay-1', cardId: 'card-1', amount: 300, balanceBefore: 842.5, balanceAfter: 542.5, paidAt: '2026-08-10T10:00:00.000Z', method: 'Bank transfer', notes: null,
    });
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        entityType: 'credit_card_due',
        entityId: 'card-1',
        entityLabel: 'Visa Platinum',
        beforeValue: { statementBalance: 842.5 },
        afterValue: { statementBalance: 542.5, amountPaid: 300 },
      })
    );
  });

  it('throws when fetching the card fails, without inserting a payment', async () => {
    selectSingleMock.mockResolvedValue({ data: null, error: new Error('card not found') });

    await expect(recordCardPayment('card-1', { amount: 300, paidAt: '2026-08-10T10:00:00.000Z' })).rejects.toThrow('card not found');
    expect(insertSelectSingleMock).not.toHaveBeenCalled();
  });

  it('throws when the update fails, after the payment row was already inserted', async () => {
    selectSingleMock.mockResolvedValue({ data: { card_name: 'Visa Platinum', statement_balance: 842.5 }, error: null });
    insertSelectSingleMock.mockResolvedValue({ data: paymentRow, error: null });
    updateEqMock.mockResolvedValue({ error: new Error('update failed') });

    await expect(recordCardPayment('card-1', { amount: 300, paidAt: '2026-08-10T10:00:00.000Z' })).rejects.toThrow('update failed');
    expect(insertSelectSingleMock).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/credit-card-payments-repository.test.ts`
Expected: FAIL — `Cannot find module './credit-card-payments-repository'`

- [ ] **Step 3: Write the implementation**

Create `lib/credit-card-payments-repository.ts`:

```ts
import { createClient } from './supabase/client';
import { logActivity } from './audit-log-repository';

export interface CreditCardPayment {
  id: string;
  cardId: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  paidAt: string;
  method: string | null;
  notes: string | null;
}

interface CreditCardPaymentRow {
  id: string;
  card_id: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  paid_at: string;
  method: string | null;
  notes: string | null;
}

function rowToPayment(row: CreditCardPaymentRow): CreditCardPayment {
  return {
    id: row.id,
    cardId: row.card_id,
    amount: row.amount,
    balanceBefore: row.balance_before,
    balanceAfter: row.balance_after,
    paidAt: row.paid_at,
    method: row.method,
    notes: row.notes,
  };
}

export async function listPaymentsForCard(cardId: string): Promise<CreditCardPayment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('credit_card_payments')
    .select('*')
    .eq('card_id', cardId)
    .order('paid_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as CreditCardPaymentRow[]).map(rowToPayment);
}

export interface RecordCardPaymentInput {
  amount: number;
  paidAt: string;
  method?: string | null;
  notes?: string | null;
}

export async function recordCardPayment(cardId: string, input: RecordCardPaymentInput): Promise<CreditCardPayment> {
  const supabase = createClient();

  const { data: cardData, error: cardError } = await supabase
    .from('credit_card_dues')
    .select('card_name, statement_balance')
    .eq('id', cardId)
    .single();
  if (cardError) throw cardError;

  const cardRow = cardData as { card_name: string; statement_balance: number };
  const balanceBefore = cardRow.statement_balance;
  const balanceAfter = balanceBefore - input.amount;

  const { data: paymentData, error: insertError } = await supabase
    .from('credit_card_payments')
    .insert({
      card_id: cardId,
      amount: input.amount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      paid_at: input.paidAt,
      method: input.method ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (insertError) throw insertError;

  const { error: updateError } = await supabase
    .from('credit_card_dues')
    .update({ statement_balance: balanceAfter })
    .eq('id', cardId);
  if (updateError) throw updateError;

  logActivity({
    action: 'update',
    entityType: 'credit_card_due',
    entityId: cardId,
    entityLabel: cardRow.card_name,
    beforeValue: { statementBalance: balanceBefore },
    afterValue: { statementBalance: balanceAfter, amountPaid: input.amount },
  }).catch(() => {});

  return rowToPayment(paymentData as CreditCardPaymentRow);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/credit-card-payments-repository.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/credit-card-payments-repository.ts lib/credit-card-payments-repository.test.ts
git commit -m "feat: add credit-card-payments-repository with listPaymentsForCard/recordCardPayment"
```

---

### Task 3: `lib/credit-card-payment-selectors.ts`

**Files:**
- Create: `lib/credit-card-payment-selectors.ts`
- Create: `lib/credit-card-payment-selectors.test.ts`

**Interfaces:**
- Consumes: `CreditCardPayment` from `./credit-card-payments-repository` (Task 2).
- Produces: `totalPaid(payments: CreditCardPayment[]): number`, `lastPaymentDate(payments: CreditCardPayment[]): string | null` — consumed by the card detail page (Phase 2).

- [ ] **Step 1: Write the failing test**

Create `lib/credit-card-payment-selectors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { totalPaid, lastPaymentDate } from './credit-card-payment-selectors';
import type { CreditCardPayment } from './credit-card-payments-repository';

const payments: CreditCardPayment[] = [
  { id: 'pay-2', cardId: 'card-1', amount: 300, balanceBefore: 542.5, balanceAfter: 242.5, paidAt: '2026-08-10T10:00:00.000Z', method: null, notes: null },
  { id: 'pay-1', cardId: 'card-1', amount: 400, balanceBefore: 942.5, balanceAfter: 542.5, paidAt: '2026-07-28T09:00:00.000Z', method: null, notes: null },
];

describe('totalPaid', () => {
  it('sums every payment amount', () => {
    expect(totalPaid(payments)).toBe(700);
  });

  it('returns 0 for an empty list', () => {
    expect(totalPaid([])).toBe(0);
  });
});

describe('lastPaymentDate', () => {
  it('returns the first payment\'s date (list is newest-first)', () => {
    expect(lastPaymentDate(payments)).toBe('2026-08-10T10:00:00.000Z');
  });

  it('returns null for an empty list', () => {
    expect(lastPaymentDate([])).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/credit-card-payment-selectors.test.ts`
Expected: FAIL — `Cannot find module './credit-card-payment-selectors'`

- [ ] **Step 3: Write the implementation**

Create `lib/credit-card-payment-selectors.ts`:

```ts
import type { CreditCardPayment } from './credit-card-payments-repository';

export function totalPaid(payments: CreditCardPayment[]): number {
  return payments.reduce((sum, payment) => sum + payment.amount, 0);
}

export function lastPaymentDate(payments: CreditCardPayment[]): string | null {
  return payments[0]?.paidAt ?? null;
}
```

Note: `lastPaymentDate` relies on the list already being newest-first, which is `listPaymentsForCard`'s own ordering contract (Task 2) — this selector doesn't re-sort.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/credit-card-payment-selectors.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/credit-card-payment-selectors.ts lib/credit-card-payment-selectors.test.ts
git commit -m "feat: add credit-card-payment-selectors for summary stats"
```

---

### Task 4: `lib/use-card-payments.ts` hook

**Files:**
- Create: `lib/use-card-payments.ts`
- Create: `lib/use-card-payments.test.ts`

**Interfaces:**
- Consumes: `listPaymentsForCard`, `recordCardPayment`, `CreditCardPayment`, `RecordCardPaymentInput` from `./credit-card-payments-repository` (Task 2).
- Produces: `useCardPayments(cardId: string): { payments: CreditCardPayment[]; loading: boolean; error: string | null; refresh: () => Promise<void>; recordPayment: (input: RecordCardPaymentInput) => Promise<void>; }` — consumed by the card detail page (Phase 2).

- [ ] **Step 1: Write the failing test**

Create `lib/use-card-payments.test.ts`:

```ts
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const { listPaymentsForCardMock, recordCardPaymentMock } = vi.hoisted(() => ({
  listPaymentsForCardMock: vi.fn(),
  recordCardPaymentMock: vi.fn(),
}));

vi.mock('./credit-card-payments-repository', () => ({
  listPaymentsForCard: listPaymentsForCardMock,
  recordCardPayment: recordCardPaymentMock,
}));

import { useCardPayments } from './use-card-payments';

const payment = {
  id: 'pay-1', cardId: 'card-1', amount: 300, balanceBefore: 842.5, balanceAfter: 542.5, paidAt: '2026-08-10T10:00:00.000Z', method: null, notes: null,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('useCardPayments', () => {
  it('loads payments for the given card on mount', async () => {
    listPaymentsForCardMock.mockResolvedValue([payment]);
    const { result } = renderHook(() => useCardPayments('card-1'));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.payments).toEqual([payment]);
    expect(listPaymentsForCardMock).toHaveBeenCalledWith('card-1');
    expect(result.current.error).toBeNull();
  });

  it('sets an error message when loading fails', async () => {
    listPaymentsForCardMock.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useCardPayments('card-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('network down');
  });

  it('recordPayment() calls the repository and refreshes', async () => {
    listPaymentsForCardMock.mockResolvedValueOnce([]).mockResolvedValueOnce([payment]);
    recordCardPaymentMock.mockResolvedValue(payment);
    const { result } = renderHook(() => useCardPayments('card-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.recordPayment({ amount: 300, paidAt: '2026-08-10T10:00:00.000Z' });
    });

    expect(recordCardPaymentMock).toHaveBeenCalledWith('card-1', { amount: 300, paidAt: '2026-08-10T10:00:00.000Z' });
    expect(result.current.payments).toEqual([payment]);
  });

  it('surfaces a mutation error without crashing', async () => {
    listPaymentsForCardMock.mockResolvedValue([]);
    recordCardPaymentMock.mockRejectedValue(new Error('cannot record payment'));
    const { result } = renderHook(() => useCardPayments('card-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.recordPayment({ amount: 300, paidAt: '2026-08-10T10:00:00.000Z' })).rejects.toThrow('cannot record payment');
    });

    expect(result.current.error).toBe('cannot record payment');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/use-card-payments.test.ts`
Expected: FAIL — `Cannot find module './use-card-payments'`

- [ ] **Step 3: Write the implementation**

Create `lib/use-card-payments.ts`:

```ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { listPaymentsForCard, recordCardPayment, type CreditCardPayment, type RecordCardPaymentInput } from './credit-card-payments-repository';

export interface UseCardPaymentsResult {
  payments: CreditCardPayment[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  recordPayment: (input: RecordCardPaymentInput) => Promise<void>;
}

export function useCardPayments(cardId: string): UseCardPaymentsResult {
  const [payments, setPayments] = useState<CreditCardPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await listPaymentsForCard(cardId);
      if (requestId !== requestIdRef.current) return;
      setPayments(result);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load payment history');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [cardId]);

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
    payments,
    loading,
    error,
    refresh,
    recordPayment: (input) => runMutation(() => recordCardPayment(cardId, input)),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/use-card-payments.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/use-card-payments.ts lib/use-card-payments.test.ts
git commit -m "feat: add useCardPayments hook"
```

---

### Task 5: Full suite verification

**Files:** None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All test files pass.

- [ ] **Step 2: Run the TypeScript compiler**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Run the linter**

Run: `npx eslint .`
Expected: No errors.

- [ ] **Step 4: Run the production build**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 5: Manual note**

Not executable in this environment — flag to the user: this phase ships no UI yet (Phase 2 does). After Phase 2 lands and migration `0014_credit_card_payments.sql` is applied, the feature becomes usable end to end.
