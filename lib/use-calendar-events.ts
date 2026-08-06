'use client';

import { useMemo } from 'react';
import { mockEvents } from './mock-data';
import type { CalendarEvent } from './types';
import { toISODateString } from './date-utils';

export function useCalendarEvents() {
  const events = mockEvents;

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const existing = map.get(event.date) ?? [];
      existing.push(event);
      map.set(event.date, existing);
    }
    return map;
  }, [events]);

  function getEventsForDate(date: Date): CalendarEvent[] {
    return eventsByDate.get(toISODateString(date)) ?? [];
  }

  return { events, getEventsForDate };
}
