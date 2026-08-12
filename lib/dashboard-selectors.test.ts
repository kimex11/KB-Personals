import { describe, expect, it } from 'vitest';
import { getOverdueBills, getBillsDueWithinDays, getBillsDueInMonth, totalBillAmount, getUpcomingReminders } from './dashboard-selectors';
import type { CalendarEvent } from './types';

const referenceDate = new Date(2026, 7, 15); // 2026-08-15

const events: CalendarEvent[] = [
  { id: '1', type: 'bill', title: 'Overdue Rent', date: '2026-08-10', amount: 1450 },
  { id: '2', type: 'bill', title: 'Due Today', date: '2026-08-15', amount: 50 },
  { id: '3', type: 'bill', title: 'Due In 3 Days', date: '2026-08-18', amount: 20 },
  { id: '4', type: 'bill', title: 'Due In 10 Days', date: '2026-08-25', amount: 30 },
  { id: '5', type: 'reminder', title: 'Call bank', date: '2026-08-16' },
  { id: '6', type: 'reminder', title: 'Renew passport', date: '2026-08-20' },
  { id: '7', type: 'reminder', title: 'Past reminder', date: '2026-08-01' },
  { id: '8', type: 'task', title: 'Reconcile receipts', date: '2026-08-16' },
  { id: '9', type: 'bill', title: 'Next Month Bill', date: '2026-09-05', amount: 999 },
];

describe('getOverdueBills', () => {
  it('returns only bills dated before the reference date', () => {
    const overdue = getOverdueBills(events, referenceDate);
    expect(overdue.map((e) => e.id)).toEqual(['1']);
  });
});

describe('getBillsDueWithinDays', () => {
  it('returns bills due today through N days out, sorted ascending', () => {
    const dueThisWeek = getBillsDueWithinDays(events, 7, referenceDate);
    expect(dueThisWeek.map((e) => e.id)).toEqual(['2', '3']);
  });
});

describe('getBillsDueInMonth', () => {
  it('returns only bills due within the reference date\'s calendar month, sorted ascending', () => {
    const dueThisMonth = getBillsDueInMonth(events, referenceDate);
    expect(dueThisMonth.map((e) => e.id)).toEqual(['1', '2', '3', '4']);
  });

  it('excludes bills due in a different month', () => {
    const dueThisMonth = getBillsDueInMonth(events, referenceDate);
    expect(dueThisMonth.map((e) => e.id)).not.toContain('9');
  });
});

describe('totalBillAmount', () => {
  it('sums the amount of every given event', () => {
    expect(totalBillAmount(getBillsDueInMonth(events, referenceDate))).toBe(1450 + 50 + 20 + 30);
  });

  it('returns 0 for an empty list', () => {
    expect(totalBillAmount([])).toBe(0);
  });
});

describe('getUpcomingReminders', () => {
  it('returns only future-or-today reminders, sorted ascending, capped at count', () => {
    const upcoming = getUpcomingReminders(events, 2, referenceDate);
    expect(upcoming.map((e) => e.id)).toEqual(['5', '6']);
  });

  it('excludes non-reminder event types', () => {
    const upcoming = getUpcomingReminders(events, 10, referenceDate);
    expect(upcoming.every((e) => e.type === 'reminder')).toBe(true);
  });
});
