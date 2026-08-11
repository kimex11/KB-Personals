# Activity Log — Phase 4 (wire into Accounts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every Accounts mutation (create/update/delete a credit card due, create/update/delete an income source) writes one `audit_log` entry via `logActivity`, following the same pattern Phases 2-3 established.

**Architecture:** Identical approach: `logActivity` calls live in `lib/use-accounts.ts`, using the hook's in-memory `cards`/`incomeSources` arrays for "before" snapshots, fire-and-forget. `lib/use-accounts.ts` is simpler than `use-bills.ts`/`use-reminders.ts` — no offline queueing, no recurring-series branching, just a shared `runMutation` helper — so each wrapper only needs a `.then()` tacked onto its repository call inside the function passed to `runMutation`, plus a `before` lookup added ahead of `runMutation` for update/delete.

**Tech Stack:** React 19, TypeScript, vitest + @testing-library/react.

## Global Constraints

- No change to any `lib/accounts-repository.ts` function signature or behavior.
- Every `logActivity` call is fire-and-forget (`.catch(() => {})`).
- Two entity types share this one hook: `entityType: 'credit_card_due'` for cards, `entityType: 'income_source'` for income. `entityLabel` is the card's `cardName` or the income source's `name`.

---

### Task 1: Wire `logActivity` into every `useAccounts` mutation

**Files:**
- Modify: `lib/use-accounts.ts`
- Modify: `lib/use-accounts.test.ts`

**Interfaces:**
- Consumes: `logActivity` from `./audit-log-repository` (Phase 1).
- No changes to `UseAccountsResult`'s public shape.

- [ ] **Step 1: Write the failing tests**

In `lib/use-accounts.test.ts`, add `logActivityMock` to the hoisted mocks and add the `audit-log-repository` mock:

```ts
const {
  listCreditCardDuesMock,
  createCreditCardDueMock,
  deleteCreditCardDueMock,
  listIncomeSourcesMock,
  createIncomeSourceMock,
  deleteIncomeSourceMock,
  logActivityMock,
} = vi.hoisted(() => ({
  listCreditCardDuesMock: vi.fn(),
  createCreditCardDueMock: vi.fn(),
  deleteCreditCardDueMock: vi.fn(),
  listIncomeSourcesMock: vi.fn(),
  createIncomeSourceMock: vi.fn(),
  deleteIncomeSourceMock: vi.fn(),
  logActivityMock: vi.fn(),
}));

vi.mock('./accounts-repository', () => ({
  listCreditCardDues: listCreditCardDuesMock,
  createCreditCardDue: createCreditCardDueMock,
  updateCreditCardDue: vi.fn(),
  deleteCreditCardDue: deleteCreditCardDueMock,
  listIncomeSources: listIncomeSourcesMock,
  createIncomeSource: createIncomeSourceMock,
  updateIncomeSource: vi.fn(),
  deleteIncomeSource: deleteIncomeSourceMock,
}));

vi.mock('./audit-log-repository', () => ({ logActivity: logActivityMock }));
```

(replaces the existing `vi.hoisted`/`vi.mock('./accounts-repository', ...)` block)

Add, right after the existing `afterEach(() => { vi.clearAllMocks(); });`:

```ts
beforeEach(() => {
  logActivityMock.mockResolvedValue(undefined);
});
```

(needs `beforeEach` added to the `vitest` import: `import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';`)

Add these tests inside `describe('useAccounts', ...)`, after `'createCard() calls the repository and refreshes cards'`:

```ts
  it('createCard() logs a create activity', async () => {
    listCreditCardDuesMock.mockResolvedValueOnce([]).mockResolvedValueOnce([card]);
    listIncomeSourcesMock.mockResolvedValue([]);
    createCreditCardDueMock.mockResolvedValue(card);
    const { result } = renderHook(() => useAccounts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createCard({ cardName: 'Visa Platinum', last4: '4821', statementBalance: 842.5, minimumPayment: 45, dueDate: '2026-08-16' });
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', entityType: 'credit_card_due', entityId: 'card-1', entityLabel: 'Visa Platinum' })
    );
  });

  it('updateCard() logs an update activity with before and after snapshots', async () => {
    listCreditCardDuesMock.mockResolvedValue([card]);
    listIncomeSourcesMock.mockResolvedValue([]);
    const { result } = renderHook(() => useAccounts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateCard('card-1', { statementBalance: 900 });
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        entityType: 'credit_card_due',
        entityId: 'card-1',
        entityLabel: 'Visa Platinum',
        beforeValue: expect.objectContaining({ statementBalance: 842.5 }),
        afterValue: expect.objectContaining({ statementBalance: 900 }),
      })
    );
  });
```

After `'deleteCard() surfaces a mutation error without crashing'`:

```ts
  it('deleteCard() logs a delete activity', async () => {
    listCreditCardDuesMock.mockResolvedValue([card]);
    listIncomeSourcesMock.mockResolvedValue([]);
    deleteCreditCardDueMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useAccounts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteCard('card-1');
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delete', entityType: 'credit_card_due', entityId: 'card-1', entityLabel: 'Visa Platinum' })
    );
  });
```

After `'createIncome() calls the repository and refreshes income sources'`:

```ts
  it('createIncome() logs a create activity', async () => {
    listCreditCardDuesMock.mockResolvedValue([]);
    listIncomeSourcesMock.mockResolvedValueOnce([]).mockResolvedValueOnce([income]);
    createIncomeSourceMock.mockResolvedValue(income);
    const { result } = renderHook(() => useAccounts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createIncome({ name: 'Salary', amount: 3200, frequency: 'biweekly', nextDate: '2026-08-20' });
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', entityType: 'income_source', entityId: 'income-1', entityLabel: 'Salary' })
    );
  });

  it('updateIncome() logs an update activity with before and after snapshots', async () => {
    listCreditCardDuesMock.mockResolvedValue([]);
    listIncomeSourcesMock.mockResolvedValue([income]);
    const { result } = renderHook(() => useAccounts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateIncome('income-1', { amount: 3400 });
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        entityType: 'income_source',
        entityId: 'income-1',
        entityLabel: 'Salary',
        beforeValue: expect.objectContaining({ amount: 3200 }),
        afterValue: expect.objectContaining({ amount: 3400 }),
      })
    );
  });

  it('deleteIncome() logs a delete activity', async () => {
    listCreditCardDuesMock.mockResolvedValue([]);
    listIncomeSourcesMock.mockResolvedValue([income]);
    const { result } = renderHook(() => useAccounts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteIncome('income-1');
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delete', entityType: 'income_source', entityId: 'income-1', entityLabel: 'Salary' })
    );
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/use-accounts.test.ts`
Expected: FAIL — the 6 new tests fail; all pre-existing tests still pass.

- [ ] **Step 3: Update the implementation**

In `lib/use-accounts.ts`, add the import:

```ts
import { logActivity } from './audit-log-repository';
```

Replace the `return { ... }` object's six mutation methods (everything else — `cards`, `incomeSources`, `loading`, `error`, `refresh` — is unchanged):

```ts
    createCard: (input) =>
      runMutation(() =>
        createCreditCardDue(input).then((created) => {
          logActivity({
            action: 'create',
            entityType: 'credit_card_due',
            entityId: created.id,
            entityLabel: created.cardName,
            afterValue: { cardName: created.cardName, last4: created.last4, statementBalance: created.statementBalance, minimumPayment: created.minimumPayment, dueDate: created.dueDate },
          }).catch(() => {});
        })
      ),
    updateCard: (id, patch) => {
      const before = cards.find((c) => c.id === id);
      return runMutation(() =>
        updateCreditCardDue(id, patch).then(() => {
          logActivity({
            action: 'update',
            entityType: 'credit_card_due',
            entityId: id,
            entityLabel: patch.cardName ?? before?.cardName ?? 'Card',
            beforeValue: before
              ? { cardName: before.cardName, last4: before.last4, statementBalance: before.statementBalance, minimumPayment: before.minimumPayment, dueDate: before.dueDate }
              : null,
            afterValue: { ...before, ...patch },
          }).catch(() => {});
        })
      );
    },
    deleteCard: (id) => {
      const before = cards.find((c) => c.id === id);
      return runMutation(() =>
        deleteCreditCardDue(id).then(() => {
          logActivity({
            action: 'delete',
            entityType: 'credit_card_due',
            entityId: id,
            entityLabel: before?.cardName ?? 'Card',
            beforeValue: before ? { cardName: before.cardName, last4: before.last4, statementBalance: before.statementBalance, dueDate: before.dueDate } : null,
          }).catch(() => {});
        })
      );
    },
    createIncome: (input) =>
      runMutation(() =>
        createIncomeSource(input).then((created) => {
          logActivity({
            action: 'create',
            entityType: 'income_source',
            entityId: created.id,
            entityLabel: created.name,
            afterValue: { name: created.name, amount: created.amount, frequency: created.frequency, nextDate: created.nextDate },
          }).catch(() => {});
        })
      ),
    updateIncome: (id, patch) => {
      const before = incomeSources.find((i) => i.id === id);
      return runMutation(() =>
        updateIncomeSource(id, patch).then(() => {
          logActivity({
            action: 'update',
            entityType: 'income_source',
            entityId: id,
            entityLabel: patch.name ?? before?.name ?? 'Income',
            beforeValue: before ? { name: before.name, amount: before.amount, frequency: before.frequency, nextDate: before.nextDate } : null,
            afterValue: { ...before, ...patch },
          }).catch(() => {});
        })
      );
    },
    deleteIncome: (id) => {
      const before = incomeSources.find((i) => i.id === id);
      return runMutation(() =>
        deleteIncomeSource(id).then(() => {
          logActivity({
            action: 'delete',
            entityType: 'income_source',
            entityId: id,
            entityLabel: before?.name ?? 'Income',
            beforeValue: before ? { name: before.name, amount: before.amount, frequency: before.frequency, nextDate: before.nextDate } : null,
          }).catch(() => {});
        })
      );
    },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/use-accounts.test.ts`
Expected: PASS (all pre-existing tests plus the 6 new ones)

- [ ] **Step 5: Commit**

```bash
git add lib/use-accounts.ts lib/use-accounts.test.ts
git commit -m "feat: log account mutations to the Activity Log"
```

---

### Task 2: Full suite verification

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

- [ ] **Step 5: Manual smoke check (note only)**

Not executable in this environment — flag to the user: create/edit/delete a credit card due and an income source on `/accounts`, then check `/activity` shows those entries with correct before/after values.
