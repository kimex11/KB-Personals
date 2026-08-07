import { describe, expect, it } from 'vitest';
import { generateMockBills } from './bills-data';

describe('generateMockBills', () => {
  const bills = generateMockBills(new Date(2026, 7, 15));

  it('generates at least 8 bills', () => {
    expect(bills.length).toBeGreaterThanOrEqual(8);
  });

  it('gives every bill a positive amount', () => {
    for (const bill of bills) {
      expect(bill.amount).toBeGreaterThan(0);
    }
  });

  it('assigns each bill a unique id', () => {
    const ids = bills.map((bill) => bill.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes a mix of paid and unpaid bills', () => {
    expect(bills.some((bill) => bill.paid)).toBe(true);
    expect(bills.some((bill) => !bill.paid)).toBe(true);
  });

  it('includes a mix of recurring and non-recurring bills', () => {
    expect(bills.some((bill) => bill.recurrence !== null)).toBe(true);
    expect(bills.some((bill) => bill.recurrence === null)).toBe(true);
  });
});
