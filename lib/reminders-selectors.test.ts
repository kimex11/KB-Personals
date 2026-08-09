import { describe, expect, it } from 'vitest';
import { isOverdue, filterReminders, sortReminders, remindersSummary } from './reminders-selectors';
import type { Reminder } from './reminders-types';

const referenceDate = new Date(2026, 7, 15); // 2026-08-15

const reminders: Reminder[] = [
  { id: '1', title: 'Call bank', category: 'Finance', dueDate: '2026-08-10', priority: 'high', completed: false, seriesId: null, cycleNumber: null, skipped: false },
  { id: '2', title: 'Renew passport', category: 'Personal', dueDate: '2026-08-15', priority: 'medium', completed: false, seriesId: null, cycleNumber: null, skipped: false },
  { id: '3', title: 'Water plants', category: 'Home', dueDate: '2026-08-20', priority: 'low', completed: false, seriesId: null, cycleNumber: null, skipped: false },
  { id: '4', title: 'Old task', category: 'Finance', dueDate: '2026-08-01', priority: 'high', completed: true, seriesId: null, cycleNumber: null, skipped: false },
];

describe('isOverdue', () => {
  it('returns true for an incomplete reminder dated before the reference date', () => {
    expect(isOverdue(reminders[0], referenceDate)).toBe(true);
  });

  it('returns false for a completed reminder even if its due date has passed', () => {
    expect(isOverdue(reminders[3], referenceDate)).toBe(false);
  });

  it('returns false for a reminder due today or in the future', () => {
    expect(isOverdue(reminders[1], referenceDate)).toBe(false);
    expect(isOverdue(reminders[2], referenceDate)).toBe(false);
  });
});

describe('filterReminders', () => {
  it('filters by case-insensitive title or category match', () => {
    const result = filterReminders(reminders, 'bank', 'all');
    expect(result.map((r) => r.id)).toEqual(['1']);
  });

  it('filters by priority', () => {
    const result = filterReminders(reminders, '', 'high');
    expect(result.map((r) => r.id)).toEqual(['1', '4']);
  });

  it('returns all reminders for empty query and "all" priority', () => {
    expect(filterReminders(reminders, '', 'all')).toHaveLength(4);
  });
});

describe('sortReminders', () => {
  it('sorts by due date ascending', () => {
    const sorted = sortReminders(reminders, 'dueDate');
    expect(sorted.map((r) => r.id)).toEqual(['4', '1', '2', '3']);
  });

  it('sorts by priority (high, medium, low)', () => {
    const sorted = sortReminders(reminders, 'priority');
    expect(sorted.map((r) => r.priority)).toEqual(['high', 'high', 'medium', 'low']);
  });
});

describe('remindersSummary', () => {
  it('counts reminders due today and overdue, excluding completed', () => {
    expect(remindersSummary(reminders, referenceDate)).toEqual({ dueTodayCount: 1, overdueCount: 1 });
  });
});
