# Activity Log — Phase 3 (wire into Reminders) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every Reminders mutation (create, create-recurring, edit, mark complete/incomplete, skip a cycle, snooze, delete) writes one `audit_log` entry via `logActivity`, following the exact pattern Phase 2 established for Bills.

**Architecture:** Identical to Phase 2: `logActivity` calls live in `lib/use-reminders.ts`, using the hook's in-memory `reminders` array for "before" snapshots, fire-and-forget (`.catch(() => {})`). `lib/use-reminders.ts` has one method Bills doesn't — `snooze` — which also gets a `logActivity` call (`action: 'update'`, since snoozing is just a `dueDate` field update, not a distinct action type).

**Tech Stack:** React 19, TypeScript, vitest + @testing-library/react.

## Global Constraints

- No change to any `lib/reminders-repository.ts` function signature or behavior, same reasoning as Phase 2's Global Constraints.
- Every `logActivity` call is fire-and-forget.
- `entityLabel` is always the reminder's `title`.

---

### Task 1: Wire `logActivity` into every `useReminders` mutation

**Files:**
- Modify: `lib/use-reminders.ts`
- Modify: `lib/use-reminders.test.ts`

**Interfaces:**
- Consumes: `logActivity` from `./audit-log-repository` (Phase 1).
- No changes to `UseRemindersResult`'s public shape.

- [ ] **Step 1: Write the failing tests**

In `lib/use-reminders.test.ts`, add the hoisted mock and import alongside the existing ones:

```ts
const { listRemindersMock, createReminderMock, updateReminderMock, deleteReminderMock, createRecurringReminderMock, closeReminderCycleMock, logActivityMock } = vi.hoisted(() => ({
  listRemindersMock: vi.fn(),
  createReminderMock: vi.fn(),
  updateReminderMock: vi.fn(),
  deleteReminderMock: vi.fn(),
  createRecurringReminderMock: vi.fn(),
  closeReminderCycleMock: vi.fn(),
  logActivityMock: vi.fn(),
}));

vi.mock('./reminders-repository', () => ({
  listReminders: listRemindersMock,
  createReminder: createReminderMock,
  updateReminder: updateReminderMock,
  deleteReminder: deleteReminderMock,
  createRecurringReminder: createRecurringReminderMock,
  closeReminderCycle: closeReminderCycleMock,
}));

vi.mock('./audit-log-repository', () => ({ logActivity: logActivityMock }));
```

(replaces the existing `vi.hoisted`/`vi.mock('./reminders-repository', ...)` block)

Change the `vitest` import to add `beforeEach`: `import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';` and add, right after the existing `afterEach(() => { vi.clearAllMocks(); });`:

```ts
beforeEach(() => {
  logActivityMock.mockResolvedValue(undefined);
});
```

Add these tests inside `describe('useReminders', ...)`:

After `'createReminder() calls the repository and refreshes'`:

```ts
  it('createReminder() logs a create activity', async () => {
    listRemindersMock.mockResolvedValueOnce([]).mockResolvedValueOnce([reminder]);
    createReminderMock.mockResolvedValue(reminder);
    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createReminder({ title: 'Renew passport', category: 'Personal', dueDate: '2026-08-16', priority: 'high' });
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', entityType: 'reminder', entityId: 'reminder-1', entityLabel: 'Renew passport' })
    );
  });

  it('updateReminder() logs an update activity with before and after snapshots', async () => {
    listRemindersMock.mockResolvedValue([reminder]);
    updateReminderMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateReminder('reminder-1', { category: 'Finance' });
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        entityType: 'reminder',
        entityId: 'reminder-1',
        entityLabel: 'Renew passport',
        beforeValue: expect.objectContaining({ category: 'Personal' }),
        afterValue: expect.objectContaining({ category: 'Finance' }),
      })
    );
  });
```

After `'toggleComplete() flips the completed flag for the given reminder'`:

```ts
  it('toggleComplete() logs an update activity', async () => {
    listRemindersMock.mockResolvedValue([reminder]);
    updateReminderMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleComplete('reminder-1');
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        entityType: 'reminder',
        entityId: 'reminder-1',
        entityLabel: 'Renew passport',
        beforeValue: { completed: false },
        afterValue: { completed: true },
      })
    );
  });
```

After `'snooze() moves the due date forward by one day'`:

```ts
  it('snooze() logs an update activity', async () => {
    listRemindersMock.mockResolvedValue([reminder]);
    updateReminderMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.snooze('reminder-1');
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        entityType: 'reminder',
        entityId: 'reminder-1',
        entityLabel: 'Renew passport',
        beforeValue: { dueDate: '2026-08-16' },
        afterValue: { dueDate: '2026-08-17' },
      })
    );
  });
```

After `'deleteReminder() surfaces a mutation error without crashing'`:

```ts
  it('deleteReminder() logs a delete activity', async () => {
    listRemindersMock.mockResolvedValue([reminder]);
    deleteReminderMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteReminder('reminder-1');
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delete', entityType: 'reminder', entityId: 'reminder-1', entityLabel: 'Renew passport' })
    );
  });
```

Add these tests inside `describe('useReminders recurring behavior', ...)`:

After `'toggleComplete() on a recurring reminder closes the cycle via closeReminderCycle, not a plain update'`:

```ts
  it('toggleComplete() on a recurring reminder logs an update activity via the closeReminderCycle path', async () => {
    listRemindersMock.mockResolvedValue([recurringReminder]);
    closeReminderCycleMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleComplete('reminder-2');
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        entityType: 'reminder',
        entityId: 'reminder-2',
        entityLabel: 'Renew passport',
        beforeValue: { completed: false },
        afterValue: { completed: true },
      })
    );
  });
```

After `'skipCycle() closes the cycle as skipped'`:

```ts
  it('skipCycle() logs a skip activity', async () => {
    listRemindersMock.mockResolvedValue([recurringReminder]);
    closeReminderCycleMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.skipCycle('reminder-2');
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'skip',
        entityType: 'reminder',
        entityId: 'reminder-2',
        entityLabel: 'Renew passport',
        beforeValue: { skipped: false },
        afterValue: { skipped: true },
      })
    );
  });
```

After `'createRecurringReminder() calls the repository and refreshes'`:

```ts
  it('createRecurringReminder() logs a create activity', async () => {
    listRemindersMock.mockResolvedValueOnce([]).mockResolvedValueOnce([recurringReminder]);
    createRecurringReminderMock.mockResolvedValue(recurringReminder);
    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createRecurringReminder(
        { title: 'Water plants', category: 'Home', dueDate: '2026-08-16', priority: 'low' },
        { frequency: 'weekly' }
      );
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', entityType: 'reminder', entityId: 'reminder-2', entityLabel: 'Renew passport' })
    );
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/use-reminders.test.ts`
Expected: FAIL — the 8 new tests fail; all pre-existing tests still pass.

- [ ] **Step 3: Update the implementation**

In `lib/use-reminders.ts`, add the import:

```ts
import { logActivity } from './audit-log-repository';
```

Replace the `return { ... }` object's methods with the following (everything outside these seven methods is unchanged):

```ts
    createReminder: (input) => {
      const tempId = crypto.randomUUID();
      return mutate(
        'createReminder',
        [input],
        () =>
          createReminder(input).then((created) => {
            logActivity({
              action: 'create',
              entityType: 'reminder',
              entityId: created.id,
              entityLabel: created.title,
              afterValue: { title: created.title, category: created.category, dueDate: created.dueDate, priority: created.priority },
            }).catch(() => {});
            return created;
          }),
        () => {
          setReminders((prev) => [
            ...prev,
            {
              id: tempId,
              title: input.title,
              category: input.category,
              dueDate: input.dueDate,
              priority: input.priority,
              completed: false,
              seriesId: null,
              cycleNumber: null,
              skipped: false,
            },
          ]);
          setPendingSyncIds((prev) => new Set(prev).add(tempId));
        }
      );
    },
    createRecurringReminder: (reminderInput, seriesInput) => {
      const tempId = crypto.randomUUID();
      return mutate(
        'createRecurringReminder',
        [reminderInput, seriesInput],
        () =>
          createRecurringReminder(reminderInput, seriesInput).then((created) => {
            logActivity({
              action: 'create',
              entityType: 'reminder',
              entityId: created.id,
              entityLabel: created.title,
              afterValue: { title: created.title, category: created.category, dueDate: created.dueDate, priority: created.priority, recurring: true },
            }).catch(() => {});
            return created;
          }),
        () => {
          setReminders((prev) => [
            ...prev,
            {
              id: tempId,
              title: reminderInput.title,
              category: reminderInput.category,
              dueDate: reminderInput.dueDate,
              priority: reminderInput.priority,
              completed: false,
              seriesId: null,
              cycleNumber: null,
              skipped: false,
            },
          ]);
          setPendingSyncIds((prev) => new Set(prev).add(tempId));
        }
      );
    },
    updateReminder: (id, patch) => {
      const before = reminders.find((r) => r.id === id);
      return withIdGuard(id, () =>
        mutate(
          'updateReminder',
          [id, patch],
          () =>
            updateReminder(id, patch).then(() => {
              logActivity({
                action: 'update',
                entityType: 'reminder',
                entityId: id,
                entityLabel: patch.title ?? before?.title ?? 'Reminder',
                beforeValue: before
                  ? { title: before.title, category: before.category, dueDate: before.dueDate, priority: before.priority, completed: before.completed }
                  : null,
                afterValue: { ...before, ...patch },
              }).catch(() => {});
            }),
          () => {
            setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
            setPendingSyncIds((prev) => new Set(prev).add(id));
          }
        )
      );
    },
    deleteReminder: (id) => {
      const before = reminders.find((r) => r.id === id);
      return withIdGuard(id, () =>
        mutate(
          'deleteReminder',
          [id],
          () =>
            deleteReminder(id).then(() => {
              logActivity({
                action: 'delete',
                entityType: 'reminder',
                entityId: id,
                entityLabel: before?.title ?? 'Reminder',
                beforeValue: before ? { title: before.title, category: before.category, dueDate: before.dueDate } : null,
              }).catch(() => {});
            }),
          () => {
            setReminders((prev) => prev.filter((r) => r.id !== id));
          }
        )
      );
    },
    toggleComplete: (id) =>
      withIdGuard(id, () => {
        const reminder = reminders.find((r) => r.id === id);
        if (!reminder) return Promise.resolve();
        if (!reminder.completed && reminder.seriesId) {
          return mutate(
            'closeReminderCycle',
            [id, 'completed'],
            () =>
              closeReminderCycle(id, 'completed').then(() => {
                logActivity({
                  action: 'update',
                  entityType: 'reminder',
                  entityId: id,
                  entityLabel: reminder.title,
                  beforeValue: { completed: false },
                  afterValue: { completed: true },
                }).catch(() => {});
              }),
            () => {
              setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, completed: true } : r)));
              setPendingSyncIds((prev) => new Set(prev).add(id));
            }
          );
        }
        return mutate(
          'updateReminder',
          [id, { completed: !reminder.completed }],
          () =>
            updateReminder(id, { completed: !reminder.completed }).then(() => {
              logActivity({
                action: 'update',
                entityType: 'reminder',
                entityId: id,
                entityLabel: reminder.title,
                beforeValue: { completed: reminder.completed },
                afterValue: { completed: !reminder.completed },
              }).catch(() => {});
            }),
          () => {
            setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, completed: !reminder.completed } : r)));
            setPendingSyncIds((prev) => new Set(prev).add(id));
          }
        );
      }),
    skipCycle: (id) =>
      withIdGuard(id, () => {
        const reminder = reminders.find((r) => r.id === id);
        return mutate(
          'closeReminderCycle',
          [id, 'skipped'],
          () =>
            closeReminderCycle(id, 'skipped').then(() => {
              logActivity({
                action: 'skip',
                entityType: 'reminder',
                entityId: id,
                entityLabel: reminder?.title ?? 'Reminder',
                beforeValue: { skipped: false },
                afterValue: { skipped: true },
              }).catch(() => {});
            }),
          () => {
            setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, skipped: true } : r)));
            setPendingSyncIds((prev) => new Set(prev).add(id));
          }
        );
      }),
    snooze: (id) =>
      withIdGuard(id, () => {
        const reminder = reminders.find((r) => r.id === id);
        if (!reminder) return Promise.resolve();
        const nextDate = toISODateString(addDays(parseISO(reminder.dueDate), 1));
        return mutate(
          'updateReminder',
          [id, { dueDate: nextDate }],
          () =>
            updateReminder(id, { dueDate: nextDate }).then(() => {
              logActivity({
                action: 'update',
                entityType: 'reminder',
                entityId: id,
                entityLabel: reminder.title,
                beforeValue: { dueDate: reminder.dueDate },
                afterValue: { dueDate: nextDate },
              }).catch(() => {});
            }),
          () => {
            setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, dueDate: nextDate } : r)));
            setPendingSyncIds((prev) => new Set(prev).add(id));
          }
        );
      }),
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/use-reminders.test.ts`
Expected: PASS (all pre-existing tests plus the 8 new ones)

- [ ] **Step 5: Commit**

```bash
git add lib/use-reminders.ts lib/use-reminders.test.ts
git commit -m "feat: log reminder mutations to the Activity Log"
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

Not executable in this environment — flag to the user: create/edit/delete/snooze a reminder and mark one complete, then check `/activity` shows those entries with correct before/after values.
