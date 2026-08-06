import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('./mock-data', () => ({
  mockEvents: [
    { id: '1', type: 'bill', title: 'Test Bill', date: '2026-08-10', amount: 10 },
    { id: '2', type: 'task', title: 'Test Task', date: '2026-08-10' },
  ],
}));

import { useCalendarEvents } from './use-calendar-events';

describe('useCalendarEvents', () => {
  it('groups mock events by their ISO date', () => {
    const { result } = renderHook(() => useCalendarEvents());
    const events = result.current.getEventsForDate(new Date(2026, 7, 10));
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.id)).toEqual(['1', '2']);
  });

  it('returns an empty array for a date with no events', () => {
    const { result } = renderHook(() => useCalendarEvents());
    const events = result.current.getEventsForDate(new Date(2099, 0, 1));
    expect(events).toEqual([]);
  });
});
