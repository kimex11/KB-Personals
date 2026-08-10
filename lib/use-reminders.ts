'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { addDays, parseISO } from 'date-fns';
import { listReminders, createReminder, updateReminder, deleteReminder, createRecurringReminder, closeReminderCycle } from './reminders-repository';
import { toISODateString } from './date-utils';
import type { Priority, Reminder } from './reminders-types';
import type { CreateSeriesInput } from './recurring-types';
import { cacheList, getCachedList } from './offline/cache';
import { attemptOrQueue } from './offline/attempt-or-queue';
import { isNetworkError } from './offline/network-error';
import { useOnlineStatus } from './offline/connectivity';
import { processQueue } from './offline/sync-engine';

export interface UseRemindersResult {
  reminders: Reminder[];
  loading: boolean;
  error: string | null;
  pendingSyncIds: Set<string>;
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
  const [pendingSyncIds, setPendingSyncIds] = useState<Set<string>>(new Set());
  const requestIdRef = useRef(0);
  const isOnline = useOnlineStatus();

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await listReminders();
      if (requestId !== requestIdRef.current) return;
      setReminders(result);
      await cacheList('reminders', result);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      if (isNetworkError(err)) {
        const cached = await getCachedList<Reminder>('reminders');
        setReminders(cached);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load reminders');
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isOnline) return;
    processQueue(refresh).then(() => setPendingSyncIds(new Set()));
  }, [isOnline, refresh]);

  const mutate = useCallback(
    async (operation: string, args: unknown[], liveCall: () => Promise<unknown>, applyOptimistic: () => void) => {
      setError(null);
      try {
        await liveCall();
        await refresh();
      } catch (err) {
        if (!isNetworkError(err)) {
          setError(err instanceof Error ? err.message : 'Action failed');
          throw err;
        }
        await attemptOrQueue('reminder', operation, args, () => Promise.reject(err), applyOptimistic);
      }
    },
    [refresh]
  );

  // Guards against a rapid double-tap firing the same mutation twice for the
  // same row before the first one resolves -- see the matching comment in
  // use-bills.ts for why this matters for closeReminderCycle specifically.
  const pendingIdsRef = useRef<Set<string>>(new Set());
  const withIdGuard = useCallback((id: string, fn: () => Promise<void>): Promise<void> => {
    if (pendingIdsRef.current.has(id)) return Promise.resolve();
    pendingIdsRef.current.add(id);
    return fn().finally(() => pendingIdsRef.current.delete(id));
  }, []);

  return {
    reminders,
    loading,
    error,
    pendingSyncIds,
    refresh,
    createReminder: (input) => {
      const tempId = crypto.randomUUID();
      return mutate(
        'createReminder',
        [input],
        () => createReminder(input),
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
        () => createRecurringReminder(reminderInput, seriesInput),
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
    updateReminder: (id, patch) =>
      withIdGuard(id, () =>
        mutate('updateReminder', [id, patch], () => updateReminder(id, patch), () => {
          setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
          setPendingSyncIds((prev) => new Set(prev).add(id));
        })
      ),
    deleteReminder: (id) =>
      withIdGuard(id, () =>
        mutate('deleteReminder', [id], () => deleteReminder(id), () => {
          setReminders((prev) => prev.filter((r) => r.id !== id));
        })
      ),
    toggleComplete: (id) =>
      withIdGuard(id, () => {
        const reminder = reminders.find((r) => r.id === id);
        if (!reminder) return Promise.resolve();
        if (!reminder.completed && reminder.seriesId) {
          return mutate('closeReminderCycle', [id, 'completed'], () => closeReminderCycle(id, 'completed'), () => {
            setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, completed: true } : r)));
            setPendingSyncIds((prev) => new Set(prev).add(id));
          });
        }
        return mutate('updateReminder', [id, { completed: !reminder.completed }], () => updateReminder(id, { completed: !reminder.completed }), () => {
          setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, completed: !reminder.completed } : r)));
          setPendingSyncIds((prev) => new Set(prev).add(id));
        });
      }),
    skipCycle: (id) =>
      withIdGuard(id, () =>
        mutate('closeReminderCycle', [id, 'skipped'], () => closeReminderCycle(id, 'skipped'), () => {
          setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, skipped: true } : r)));
          setPendingSyncIds((prev) => new Set(prev).add(id));
        })
      ),
    snooze: (id) =>
      withIdGuard(id, () => {
        const reminder = reminders.find((r) => r.id === id);
        if (!reminder) return Promise.resolve();
        const nextDate = toISODateString(addDays(parseISO(reminder.dueDate), 1));
        return mutate('updateReminder', [id, { dueDate: nextDate }], () => updateReminder(id, { dueDate: nextDate }), () => {
          setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, dueDate: nextDate } : r)));
          setPendingSyncIds((prev) => new Set(prev).add(id));
        });
      }),
  };
}
