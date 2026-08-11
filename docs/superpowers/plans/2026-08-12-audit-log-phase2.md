# Activity Log — Phase 2 (wire into Bills) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every Bills mutation (create, create-recurring, edit, mark paid/unpaid, skip a cycle, delete) writes one `audit_log` entry via `logActivity`, so the `/activity` page (Phase 1) starts showing real data.

**Architecture:** Per the design spec's Autonomous Decision #1 (refined during this phase), `logActivity` calls live in `lib/use-bills.ts` — not `lib/bills-repository.ts` — because the hook already holds the full current `bills` array in memory before calling any repository function. `bills.find((b) => b.id === id)` gives an exact "before" snapshot for free; the repository layer would need an extra `select` per mutation to get the same thing, which would also break `lib/bills-repository.test.ts`'s `updateBill` "throws on error" test (it mocks the update chain without a preceding select). Every `logActivity(...)` call ends with `.catch(() => {})` — a logging failure must never surface as a failure of the actual bill mutation.

**Tech Stack:** React 19, TypeScript, vitest + @testing-library/react (`renderHook`, `act`, `waitFor`).

## Global Constraints

- No change to any `lib/bills-repository.ts` function signature or behavior — Phase 1's decision to keep repository-level logging out applies here for real; this phase only touches `lib/use-bills.ts` and its test.
- Every `logActivity` call is fire-and-forget (`.catch(() => {})`), never `await`ed as part of the mutation's own success/failure path.
- `entityLabel` is always the bill's `title` — sourced from the in-memory `bills` array (for update/delete/toggle/skip) or from the repository call's resolved return value (for create, which doesn't have a prior in-memory row).

---

### Task 1: Wire `logActivity` into every `useBills` mutation

**Files:**
- Modify: `lib/use-bills.ts`
- Modify: `lib/use-bills.test.ts`

**Interfaces:**
- Consumes: `logActivity` from `./audit-log-repository` (Phase 1).
- No changes to `UseBillsResult`'s public shape — this is purely additive side-effect wiring inside existing methods.

- [ ] **Step 1: Write the failing tests**

In `lib/use-bills.test.ts`, add the hoisted mock and import alongside the existing ones:

```ts
const { listBillsMock, createBillMock, updateBillMock, deleteBillMock, createRecurringBillMock, closeBillCycleMock, logActivityMock } = vi.hoisted(() => ({
  listBillsMock: vi.fn(),
  createBillMock: vi.fn(),
  updateBillMock: vi.fn(),
  deleteBillMock: vi.fn(),
  createRecurringBillMock: vi.fn(),
  closeBillCycleMock: vi.fn(),
  logActivityMock: vi.fn(),
}));

vi.mock('./bills-repository', () => ({
  listBills: listBillsMock,
  createBill: createBillMock,
  updateBill: updateBillMock,
  deleteBill: deleteBillMock,
  createRecurringBill: createRecurringBillMock,
  closeBillCycle: closeBillCycleMock,
}));

vi.mock('./audit-log-repository', () => ({ logActivity: logActivityMock }));
```

(replaces the existing `vi.hoisted`/`vi.mock('./bills-repository', ...)` block — same content, one more mock name and one more `vi.mock` call)

Add `logActivityMock.mockResolvedValue(undefined);` inside the existing `afterEach(() => { vi.clearAllMocks(); });` block's sibling — actually add a `beforeEach` right after the `afterEach`:

```ts
beforeEach(() => {
  logActivityMock.mockResolvedValue(undefined);
});
```

(needs `beforeEach` added to the `vitest` import at the top: `import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';`)

Add these tests inside `describe('useBills', ...)`, after the existing `'createBill() calls the repository and refreshes'` test:

```ts
  it('createBill() logs a create activity', async () => {
    listBillsMock.mockResolvedValueOnce([]).mockResolvedValueOnce([bill]);
    createBillMock.mockResolvedValue(bill);
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createBill({ title: 'Rent', categoryId: 'cat-1', amount: 1450, dueDate: '2026-08-16', recurrence: 'monthly' });
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', entityType: 'bill', entityId: 'bill-1', entityLabel: 'Rent' })
    );
  });

  it('updateBill() logs an update activity with before and after snapshots', async () => {
    listBillsMock.mockResolvedValue([bill]);
    updateBillMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateBill('bill-1', { amount: 1500 });
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        entityType: 'bill',
        entityId: 'bill-1',
        entityLabel: 'Rent',
        beforeValue: expect.objectContaining({ amount: 1450 }),
        afterValue: expect.objectContaining({ amount: 1500 }),
      })
    );
  });
```

Add this test after the existing `'togglePaid() flips the paid flag for the given bill'` test:

```ts
  it('togglePaid() logs an update activity', async () => {
    listBillsMock.mockResolvedValue([bill]);
    updateBillMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.togglePaid('bill-1');
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        entityType: 'bill',
        entityId: 'bill-1',
        entityLabel: 'Rent',
        beforeValue: { paid: false },
        afterValue: { paid: true },
      })
    );
  });
```

Add this test after the existing `'deleteBill() surfaces a mutation error without crashing'` test:

```ts
  it('deleteBill() logs a delete activity', async () => {
    listBillsMock.mockResolvedValue([bill]);
    deleteBillMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteBill('bill-1');
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delete', entityType: 'bill', entityId: 'bill-1', entityLabel: 'Rent' })
    );
  });
```

Add these two tests inside `describe('useBills recurring behavior', ...)`, after the existing `'togglePaid() on a recurring bill closes the cycle via closeBillCycle, not a plain update'` test:

```ts
  it('togglePaid() on a recurring bill logs an update activity via the closeBillCycle path', async () => {
    listBillsMock.mockResolvedValue([recurringBill]);
    closeBillCycleMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.togglePaid('bill-2');
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        entityType: 'bill',
        entityId: 'bill-2',
        entityLabel: 'Rent',
        beforeValue: { paid: false },
        afterValue: { paid: true },
      })
    );
  });
```

And after the existing `'skipCycle() closes the cycle as skipped'` test:

```ts
  it('skipCycle() logs a skip activity', async () => {
    listBillsMock.mockResolvedValue([recurringBill]);
    closeBillCycleMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.skipCycle('bill-2');
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'skip',
        entityType: 'bill',
        entityId: 'bill-2',
        entityLabel: 'Rent',
        beforeValue: { skipped: false },
        afterValue: { skipped: true },
      })
    );
  });
```

And after the existing `'createRecurringBill() calls the repository and refreshes'` test:

```ts
  it('createRecurringBill() logs a create activity', async () => {
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

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', entityType: 'bill', entityId: 'bill-2', entityLabel: 'Rent' })
    );
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/use-bills.test.ts`
Expected: FAIL — the 7 new tests fail because `logActivityMock` is never called (the hook doesn't call `logActivity` yet); all pre-existing tests still pass.

- [ ] **Step 3: Update the implementation**

In `lib/use-bills.ts`, add the import:

```ts
import { logActivity } from './audit-log-repository';
```

(alongside the existing imports at the top of the file)

Replace the `return { ... }` object's methods with the following (everything outside these six methods — `bills`, `loading`, `error`, `pendingSyncIds`, `refresh` — is unchanged):

```ts
    createBill: (input) => {
      const tempId = crypto.randomUUID();
      return mutate(
        'createBill',
        [input],
        () =>
          createBill(input).then((created) => {
            logActivity({
              action: 'create',
              entityType: 'bill',
              entityId: created.id,
              entityLabel: created.title,
              afterValue: { title: created.title, category: created.category, amount: created.amount, dueDate: created.dueDate, recurrence: created.recurrence },
            }).catch(() => {});
            return created;
          }),
        () => {
          setBills((prev) => [
            ...prev,
            {
              id: tempId,
              title: input.title,
              category: '',
              categoryId: input.categoryId,
              amount: input.amount,
              dueDate: input.dueDate,
              recurrence: input.recurrence,
              paid: false,
              seriesId: null,
              cycleNumber: null,
              skipped: false,
            },
          ]);
          setPendingSyncIds((prev) => new Set(prev).add(tempId));
        }
      );
    },
    createRecurringBill: (billInput, seriesInput) => {
      const tempId = crypto.randomUUID();
      return mutate(
        'createRecurringBill',
        [billInput, seriesInput],
        () =>
          createRecurringBill(billInput, seriesInput).then((created) => {
            logActivity({
              action: 'create',
              entityType: 'bill',
              entityId: created.id,
              entityLabel: created.title,
              afterValue: { title: created.title, category: created.category, amount: created.amount, dueDate: created.dueDate, recurring: true },
            }).catch(() => {});
            return created;
          }),
        () => {
          setBills((prev) => [
            ...prev,
            {
              id: tempId,
              title: billInput.title,
              category: '',
              categoryId: billInput.categoryId,
              amount: billInput.amount,
              dueDate: billInput.dueDate,
              recurrence: null,
              paid: false,
              seriesId: null,
              cycleNumber: null,
              skipped: false,
            },
          ]);
          setPendingSyncIds((prev) => new Set(prev).add(tempId));
        }
      );
    },
    updateBill: (id, patch) => {
      const before = bills.find((b) => b.id === id);
      return withIdGuard(id, () =>
        mutate(
          'updateBill',
          [id, patch],
          () =>
            updateBill(id, patch).then(() => {
              logActivity({
                action: 'update',
                entityType: 'bill',
                entityId: id,
                entityLabel: patch.title ?? before?.title ?? 'Bill',
                beforeValue: before
                  ? { title: before.title, category: before.category, amount: before.amount, dueDate: before.dueDate, recurrence: before.recurrence, paid: before.paid }
                  : null,
                afterValue: { ...before, ...patch },
              }).catch(() => {});
            }),
          () => {
            setBills((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
            setPendingSyncIds((prev) => new Set(prev).add(id));
          }
        )
      );
    },
    deleteBill: (id) => {
      const before = bills.find((b) => b.id === id);
      return withIdGuard(id, () =>
        mutate(
          'deleteBill',
          [id],
          () =>
            deleteBill(id).then(() => {
              logActivity({
                action: 'delete',
                entityType: 'bill',
                entityId: id,
                entityLabel: before?.title ?? 'Bill',
                beforeValue: before ? { title: before.title, category: before.category, amount: before.amount, dueDate: before.dueDate } : null,
              }).catch(() => {});
            }),
          () => {
            setBills((prev) => prev.filter((b) => b.id !== id));
          }
        )
      );
    },
    togglePaid: (id) =>
      withIdGuard(id, () => {
        const bill = bills.find((b) => b.id === id);
        if (!bill) return Promise.resolve();
        if (!bill.paid && bill.seriesId) {
          return mutate(
            'closeBillCycle',
            [id, 'paid'],
            () =>
              closeBillCycle(id, 'paid').then(() => {
                logActivity({
                  action: 'update',
                  entityType: 'bill',
                  entityId: id,
                  entityLabel: bill.title,
                  beforeValue: { paid: false },
                  afterValue: { paid: true },
                }).catch(() => {});
              }),
            () => {
              setBills((prev) => prev.map((b) => (b.id === id ? { ...b, paid: true } : b)));
              setPendingSyncIds((prev) => new Set(prev).add(id));
            }
          );
        }
        return mutate(
          'updateBill',
          [id, { paid: !bill.paid }],
          () =>
            updateBill(id, { paid: !bill.paid }).then(() => {
              logActivity({
                action: 'update',
                entityType: 'bill',
                entityId: id,
                entityLabel: bill.title,
                beforeValue: { paid: bill.paid },
                afterValue: { paid: !bill.paid },
              }).catch(() => {});
            }),
          () => {
            setBills((prev) => prev.map((b) => (b.id === id ? { ...b, paid: !bill.paid } : b)));
            setPendingSyncIds((prev) => new Set(prev).add(id));
          }
        );
      }),
    skipCycle: (id) =>
      withIdGuard(id, () => {
        const bill = bills.find((b) => b.id === id);
        return mutate(
          'closeBillCycle',
          [id, 'skipped'],
          () =>
            closeBillCycle(id, 'skipped').then(() => {
              logActivity({
                action: 'skip',
                entityType: 'bill',
                entityId: id,
                entityLabel: bill?.title ?? 'Bill',
                beforeValue: { skipped: false },
                afterValue: { skipped: true },
              }).catch(() => {});
            }),
          () => {
            setBills((prev) => prev.map((b) => (b.id === id ? { ...b, skipped: true } : b)));
            setPendingSyncIds((prev) => new Set(prev).add(id));
          }
        );
      }),
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/use-bills.test.ts`
Expected: PASS (all pre-existing tests plus the 7 new ones)

- [ ] **Step 5: Commit**

```bash
git add lib/use-bills.ts lib/use-bills.test.ts
git commit -m "feat: log bill mutations to the Activity Log"
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

Not executable in this environment — flag to the user: after migration `0013_audit_log.sql` is applied, create/edit/delete a bill and mark one paid, then check `/activity` shows those entries with correct before/after values.
