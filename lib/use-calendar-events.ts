'use client';

import { useMemo } from 'react';
import { useBills } from './use-bills';
import { useReminders } from './use-reminders';
import type { CalendarEvent } from './types';
import { toISODateString } from './date-utils';

export function useCalendarEvents() {
  const { bills } = useBills();
  const { reminders } = useReminders();

  const events = useMemo<CalendarEvent[]>(() => {
    const billEvents: CalendarEvent[] = bills.map((bill) => ({
      id: bill.id,
      type: 'bill',
      title: bill.title,
      date: bill.dueDate,
      amount: bill.amount,
    }));
    const reminderEvents: CalendarEvent[] = reminders.map((reminder) => ({
      id: reminder.id,
      type: 'reminder',
      title: reminder.title,
      date: reminder.dueDate,
    }));
    return [...billEvents, ...reminderEvents];
  }, [bills, reminders]);

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
