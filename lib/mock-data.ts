import { addDays, startOfMonth } from 'date-fns';
import type { CalendarEvent } from './types';
import { toISODateString } from './date-utils';

interface MockEventSeed {
  dayOffset: number;
  type: CalendarEvent['type'];
  title: string;
  time?: string;
  amount?: number;
}

const EVENT_SEEDS: MockEventSeed[] = [
  { dayOffset: 2, type: 'bill', title: 'Electricity Bill', time: '9:00 AM', amount: 84.5 },
  { dayOffset: 4, type: 'reminder', title: 'Call insurance provider', time: '2:00 PM' },
  { dayOffset: 6, type: 'task', title: 'Review monthly budget' },
  { dayOffset: 9, type: 'bill', title: 'Internet Bill', time: '9:00 AM', amount: 59.99 },
  { dayOffset: 12, type: 'reminder', title: "Mom's birthday" },
  { dayOffset: 14, type: 'bill', title: 'Credit Card Payment', time: '11:00 AM', amount: 320.15 },
  { dayOffset: 14, type: 'task', title: 'Reconcile receipts' },
  { dayOffset: 18, type: 'reminder', title: 'Renew car insurance' },
  { dayOffset: 21, type: 'bill', title: 'Rent', time: '8:00 AM', amount: 1450 },
  { dayOffset: 25, type: 'task', title: 'Plan next month budget' },
];

export function generateMockEvents(baseDate: Date = new Date()): CalendarEvent[] {
  const monthStart = startOfMonth(baseDate);

  return EVENT_SEEDS.map(({ dayOffset, ...rest }, index) => ({
    id: `mock-${index}`,
    date: toISODateString(addDays(monthStart, dayOffset)),
    ...rest,
  }));
}

export const mockEvents: CalendarEvent[] = generateMockEvents();
