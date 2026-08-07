import { describe, expect, it } from 'vitest';
import { generateMockTransactions, mockGoal } from './dashboard-data';

describe('generateMockTransactions', () => {
  const base = new Date(2026, 7, 15); // 2026-08-15
  const transactions = generateMockTransactions(base);

  it('generates at least 4 transactions', () => {
    expect(transactions.length).toBeGreaterThanOrEqual(4);
  });

  it('gives every transaction a positive amount', () => {
    for (const txn of transactions) {
      expect(txn.amount).toBeGreaterThan(0);
    }
  });

  it('assigns each transaction a unique id', () => {
    const ids = transactions.map((txn) => txn.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('sorts transactions newest first', () => {
    const dates = transactions.map((txn) => txn.date);
    const sorted = [...dates].sort().reverse();
    expect(dates).toEqual(sorted);
  });

  it('dates transactions on or before the base date', () => {
    const baseStr = '2026-08-15';
    for (const txn of transactions) {
      expect(txn.date <= baseStr).toBe(true);
    }
  });
});

describe('mockGoal', () => {
  it('has a saved amount less than or equal to its target', () => {
    expect(mockGoal.saved).toBeLessThanOrEqual(mockGoal.target);
  });
});
