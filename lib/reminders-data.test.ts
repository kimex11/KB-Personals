import { describe, expect, it } from 'vitest';
import { generateMockReminders } from './reminders-data';

describe('generateMockReminders', () => {
  const reminders = generateMockReminders(new Date(2026, 7, 15));

  it('generates at least 6 reminders', () => {
    expect(reminders.length).toBeGreaterThanOrEqual(6);
  });

  it('assigns each reminder a unique id', () => {
    const ids = reminders.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes a mix of priorities', () => {
    const priorities = new Set(reminders.map((r) => r.priority));
    expect(priorities).toEqual(new Set(['high', 'medium', 'low']));
  });

  it('includes a mix of completed and incomplete reminders', () => {
    expect(reminders.some((r) => r.completed)).toBe(true);
    expect(reminders.some((r) => !r.completed)).toBe(true);
  });
});
