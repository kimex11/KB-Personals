import { describe, expect, it } from 'vitest';
import { addInterval } from './recurring-date-math';

describe('addInterval', () => {
  it('adds 1 day for daily', () => {
    expect(addInterval('2026-08-01', 'daily')).toBe('2026-08-02');
  });

  it('adds 7 days for weekly', () => {
    expect(addInterval('2026-08-01', 'weekly')).toBe('2026-08-08');
  });

  it('adds 14 days for biweekly', () => {
    expect(addInterval('2026-08-01', 'biweekly')).toBe('2026-08-15');
  });

  it('adds 1 month for monthly, clamping month-end overflow (non-leap February)', () => {
    expect(addInterval('2026-01-31', 'monthly')).toBe('2026-02-28');
  });

  it('adds 1 month for monthly, clamping into a leap-year February', () => {
    expect(addInterval('2028-01-31', 'monthly')).toBe('2028-02-29');
  });

  it('adds 3 months for quarterly, clamping into a 30-day month', () => {
    expect(addInterval('2026-01-31', 'quarterly')).toBe('2026-04-30');
  });

  it('adds 6 months for semi_annual', () => {
    expect(addInterval('2026-08-01', 'semi_annual')).toBe('2027-02-01');
  });

  it('adds 12 months for annual', () => {
    expect(addInterval('2026-08-01', 'annual')).toBe('2027-08-01');
  });

  it('adds N days for custom day interval', () => {
    expect(addInterval('2026-08-01', 'custom', 'day', 10)).toBe('2026-08-11');
  });

  it('adds N weeks for custom week interval', () => {
    expect(addInterval('2026-08-01', 'custom', 'week', 6)).toBe('2026-09-12');
  });

  it('adds N months for custom month interval, clamping month-end overflow', () => {
    expect(addInterval('2026-01-31', 'custom', 'month', 2)).toBe('2026-03-31');
  });

  it('throws when custom frequency is missing unit/count', () => {
    expect(() => addInterval('2026-08-01', 'custom')).toThrow();
  });
});
