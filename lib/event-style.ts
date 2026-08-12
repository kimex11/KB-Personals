import type { CalendarEvent } from './types';

// Single source of truth for event type -> label/color mapping, shared by
// DayCell and EventCard so their dot styling can never drift apart again.
export const TYPE_LABEL: Record<CalendarEvent['type'], string> = {
  bill: 'Bill',
  reminder: 'Reminder',
  task: 'Task',
  expense: 'Expense',
  payment: 'Payment',
};

export const TYPE_DOT_CLASS: Record<CalendarEvent['type'], string> = {
  bill: 'bg-gold',
  reminder: 'bg-calendar-reminder',
  task: 'bg-calendar-task',
  expense: 'bg-status-critical',
  payment: 'bg-status-success',
};
