'use client';

import { useMemo, useState } from 'react';
import type { Reminder, Priority } from '@/lib/reminders-types';
import { filterReminders, sortReminders, remindersSummary } from '@/lib/reminders-selectors';
import { RemindersSummary } from './RemindersSummary';
import { RemindersFilterBar } from './RemindersFilterBar';
import { ReminderRow } from './ReminderRow';
import { EmptyState } from '@/components/shared/EmptyState';

interface RemindersListViewProps {
  reminders: Reminder[];
  onToggleComplete: (id: string) => void;
  onSnooze: (id: string) => void;
  referenceDate?: Date;
}

export function RemindersListView({
  reminders,
  onToggleComplete,
  onSnooze,
  referenceDate = new Date(),
}: RemindersListViewProps) {
  const [query, setQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority'>('dueDate');

  const visibleReminders = useMemo(
    () => sortReminders(filterReminders(reminders, query, priorityFilter), sortBy),
    [reminders, query, priorityFilter, sortBy]
  );

  const summary = useMemo(() => remindersSummary(reminders, referenceDate), [reminders, referenceDate]);

  return (
    <div data-testid="reminders-list-view" className="flex flex-col gap-4">
      <RemindersSummary dueTodayCount={summary.dueTodayCount} overdueCount={summary.overdueCount} />
      <RemindersFilterBar
        query={query}
        onQueryChange={setQuery}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
        sortBy={sortBy}
        onSortByChange={setSortBy}
      />
      {visibleReminders.length === 0 ? (
        <EmptyState message="No reminders match your filters." />
      ) : (
        <div className="flex flex-col gap-2">
          {visibleReminders.map((reminder) => (
            <ReminderRow
              key={reminder.id}
              reminder={reminder}
              onToggleComplete={onToggleComplete}
              onSnooze={onSnooze}
              referenceDate={referenceDate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
