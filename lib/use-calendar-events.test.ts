import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('./use-bills', () => ({
  useBills: () => ({
    bills: [{ id: 'bill-1', title: 'Test Bill', category: 'Utilities', categoryId: 'cat-1', amount: 10, dueDate: '2026-08-10', recurrence: null, paid: false }],
    loading: false,
    error: null,
    refresh: vi.fn(),
    createBill: vi.fn(),
    updateBill: vi.fn(),
    deleteBill: vi.fn(),
    togglePaid: vi.fn(),
  }),
}));

vi.mock('./use-reminders', () => ({
  useReminders: () => ({
    reminders: [{ id: 'reminder-1', title: 'Test Reminder', category: 'Personal', dueDate: '2026-08-10', priority: 'medium', completed: false }],
    loading: false,
    error: null,
    refresh: vi.fn(),
    createReminder: vi.fn(),
    updateReminder: vi.fn(),
    deleteReminder: vi.fn(),
    toggleComplete: vi.fn(),
    snooze: vi.fn(),
  }),
}));

import { useCalendarEvents } from './use-calendar-events';

describe('useCalendarEvents', () => {
  it('derives calendar events from live bills and reminders, grouped by ISO date', () => {
    const { result } = renderHook(() => useCalendarEvents());
    const events = result.current.getEventsForDate(new Date(2026, 7, 10));
    expect(events).toHaveLength(2);
    expect(events).toContainEqual({ id: 'bill-1', type: 'bill', title: 'Test Bill', date: '2026-08-10', amount: 10 });
    expect(events).toContainEqual({ id: 'reminder-1', type: 'reminder', title: 'Test Reminder', date: '2026-08-10' });
  });

  it('returns an empty array for a date with no events', () => {
    const { result } = renderHook(() => useCalendarEvents());
    const events = result.current.getEventsForDate(new Date(2099, 0, 1));
    expect(events).toEqual([]);
  });
});
