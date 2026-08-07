import type { CalendarEvent } from './types';
import { toISODateString } from './date-utils';
import { addDays } from 'date-fns';

export function getOverdueBills(events: CalendarEvent[], referenceDate: Date = new Date()): CalendarEvent[] {
  const todayStr = toISODateString(referenceDate);
  return events
    .filter((e) => e.type === 'bill' && e.date < todayStr)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function getBillsDueWithinDays(
  events: CalendarEvent[],
  days: number,
  referenceDate: Date = new Date()
): CalendarEvent[] {
  const todayStr = toISODateString(referenceDate);
  const endStr = toISODateString(addDays(referenceDate, days));
  return events
    .filter((e) => e.type === 'bill' && e.date >= todayStr && e.date <= endStr)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function getUpcomingReminders(
  events: CalendarEvent[],
  count: number,
  referenceDate: Date = new Date()
): CalendarEvent[] {
  const todayStr = toISODateString(referenceDate);
  return events
    .filter((e) => e.type === 'reminder' && e.date >= todayStr)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, count);
}
