import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCalendarEvents } from './use-calendar-events';
import type { Bill } from './bills-types';
import type { Reminder } from './reminders-types';

const bills: Bill[] = [
  { id: 'bill-1', title: 'Test Bill', category: 'Utilities', amount: 10, dueDate: '2026-08-10', recurrence: null, paid: false, seriesId: null, cycleNumber: null, skipped: false },
];

const reminders: Reminder[] = [
  { id: 'reminder-1', title: 'Test Reminder', category: 'Personal', dueDate: '2026-08-10', priority: 'medium', completed: false, seriesId: null, cycleNumber: null, skipped: false },
];

describe('useCalendarEvents', () => {
  it('derives calendar events from the given bills and reminders, grouped by ISO date', () => {
    const { result } = renderHook(() => useCalendarEvents(bills, reminders));
    const events = result.current.getEventsForDate(new Date(2026, 7, 10));
    expect(events).toHaveLength(2);
    expect(events).toContainEqual({ id: 'bill-1', type: 'bill', title: 'Test Bill', date: '2026-08-10', amount: 10 });
    expect(events).toContainEqual({ id: 'reminder-1', type: 'reminder', title: 'Test Reminder', date: '2026-08-10' });
  });

  it('returns an empty array for a date with no events', () => {
    const { result } = renderHook(() => useCalendarEvents(bills, reminders));
    const events = result.current.getEventsForDate(new Date(2099, 0, 1));
    expect(events).toEqual([]);
  });
});
