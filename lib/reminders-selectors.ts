import type { Reminder, Priority } from './reminders-types';
import { toISODateString } from './date-utils';

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export function isOverdue(reminder: Reminder, referenceDate: Date = new Date()): boolean {
  if (reminder.completed) return false;
  return reminder.dueDate < toISODateString(referenceDate);
}

export function filterReminders(reminders: Reminder[], query: string, priorityFilter: Priority | 'all'): Reminder[] {
  const q = query.trim().toLowerCase();
  return reminders.filter((reminder) => {
    const matchesQuery =
      q === '' || reminder.title.toLowerCase().includes(q) || reminder.category.toLowerCase().includes(q);
    const matchesPriority = priorityFilter === 'all' || reminder.priority === priorityFilter;
    return matchesQuery && matchesPriority;
  });
}

export function sortReminders(reminders: Reminder[], sortBy: 'dueDate' | 'priority'): Reminder[] {
  const copy = [...reminders];
  if (sortBy === 'priority') {
    copy.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  } else {
    copy.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  }
  return copy;
}

export function remindersSummary(
  reminders: Reminder[],
  referenceDate: Date = new Date()
): { dueTodayCount: number; overdueCount: number } {
  const todayStr = toISODateString(referenceDate);
  const dueTodayCount = reminders.filter((r) => !r.completed && r.dueDate === todayStr).length;
  const overdueCount = reminders.filter((r) => isOverdue(r, referenceDate)).length;
  return { dueTodayCount, overdueCount };
}
