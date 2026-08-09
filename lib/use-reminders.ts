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
      if (requestId !== requestIdRef.current) return; // a newer refresh already landed
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
