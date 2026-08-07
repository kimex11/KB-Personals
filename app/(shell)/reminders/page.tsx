'use client';

import { useState } from 'react';
import { addDays, parseISO } from 'date-fns';
import { mockReminders } from '@/lib/reminders-data';
import { RemindersListView } from '@/components/reminders/RemindersListView';
import { toISODateString } from '@/lib/date-utils';
import { useIsMounted } from '@/lib/use-is-mounted';

export default function RemindersPage() {
  const [completedOverrides, setCompletedOverrides] = useState<Set<string>>(new Set());
  const [snoozedDates, setSnoozedDates] = useState<Map<string, string>>(new Map());
  const isMounted = useIsMounted();

  const reminders = mockReminders.map((reminder) => ({
    ...reminder,
    completed: reminder.completed || completedOverrides.has(reminder.id),
    dueDate: snoozedDates.get(reminder.id) ?? reminder.dueDate,
  }));

  function toggleComplete(id: string) {
    setCompletedOverrides((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function snooze(id: string) {
    const reminder = reminders.find((r) => r.id === id);
    if (!reminder) return;
    setSnoozedDates((prev) => {
      const next = new Map(prev);
      next.set(id, toISODateString(addDays(parseISO(reminder.dueDate), 1)));
      return next;
    });
  }

  return (
    <div data-testid="reminders-page" className="flex flex-col gap-4 px-4 pb-24 pt-4">
      {isMounted && (
        <RemindersListView
          reminders={reminders}
          onToggleComplete={toggleComplete}
          onSnooze={snooze}
          referenceDate={new Date()}
        />
      )}
    </div>
  );
}
