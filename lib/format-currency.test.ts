import { describe, expect, it } from 'vitest';
import { formatCurrency } from './format-currency';

describe('formatCurrency', () => {
  it('adds a thousands separator', () => {
    expect(formatCurrency(1918)).toBe('1,918.00');
  });

  it('defaults to 2 decimal places', () => {
    expect(formatCurrency(59.9)).toBe('59.90');
  });

  it('supports 0 decimal places', () => {
    expect(formatCurrency(1918, 0)).toBe('1,918');
  });

  it('handles values under 1000 with no separator needed', () => {
    expect(formatCurrency(45)).toBe('45.00');
  });

  it('handles large values with multiple separators', () => {
    expect(formatCurrency(1234567.5)).toBe('1,234,567.50');
  });
});
