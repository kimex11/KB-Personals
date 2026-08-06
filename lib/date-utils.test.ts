import { describe, expect, it } from 'vitest';
import { getMonthGrid, formatMonthLabel, toISODateString } from './date-utils';

describe('date-utils', () => {
  it('formats a month label as "Month YYYY"', () => {
    expect(formatMonthLabel(new Date(2026, 7, 6))).toBe('August 2026');
  });

  it('formats a date as an ISO yyyy-MM-dd string', () => {
    expect(toISODateString(new Date(2026, 7, 6))).toBe('2026-08-06');
  });

  it('returns a full 6-week grid padded with adjacent months', () => {
    const grid = getMonthGrid(new Date(2026, 7, 1));
    expect(grid.length).toBe(42);
    expect(grid[0].date.getDay()).toBe(0);
    expect(grid.filter((day) => day.isCurrentMonth).length).toBe(31);
  });

  it('always returns exactly 42 days, even for a 4-week month like February', () => {
    const grid = getMonthGrid(new Date(2026, 1, 1));
    expect(grid.length).toBe(42);
    expect(grid[0].date.getDay()).toBe(0);
    expect(grid.filter((day) => day.isCurrentMonth).length).toBe(28);
  });
});
