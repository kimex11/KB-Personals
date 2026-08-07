import { describe, expect, it } from 'vitest';
import {
  getBillStatus,
  groupBillsByStatus,
  filterBills,
  sortBills,
  monthlyBillTotal,
} from './bills-selectors';
import type { Bill } from './bills-types';

const referenceDate = new Date(2026, 7, 15); // 2026-08-15

const bills: Bill[] = [
  { id: '1', title: 'Rent', category: 'Housing', amount: 1450, dueDate: '2026-08-01', recurrence: 'monthly', paid: true },
  { id: '2', title: 'Credit Card', category: 'Shopping', amount: 320, dueDate: '2026-08-10', recurrence: null, paid: false },
  { id: '3', title: 'Electricity', category: 'Utilities', amount: 85, dueDate: '2026-08-15', recurrence: 'monthly', paid: false },
  { id: '4', title: 'Internet', category: 'Utilities', amount: 60, dueDate: '2026-08-17', recurrence: 'monthly', paid: false },
  { id: '5', title: 'Car Insurance', category: 'Transport', amount: 145, dueDate: '2026-08-25', recurrence: 'quarterly', paid: false },
];

describe('getBillStatus', () => {
  it('returns "paid" for a paid bill regardless of due date', () => {
    expect(getBillStatus(bills[0], referenceDate)).toBe('paid');
  });

  it('returns "overdue" for an unpaid bill dated before the reference date', () => {
    expect(getBillStatus(bills[1], referenceDate)).toBe('overdue');
  });

  it('returns "due-soon" for an unpaid bill due within 3 days', () => {
    expect(getBillStatus(bills[2], referenceDate)).toBe('due-soon');
    expect(getBillStatus(bills[3], referenceDate)).toBe('due-soon');
  });

  it('returns "upcoming" for an unpaid bill due more than 3 days out', () => {
    expect(getBillStatus(bills[4], referenceDate)).toBe('upcoming');
  });
});

describe('groupBillsByStatus', () => {
  it('groups bills by derived status, preserving input order within each group', () => {
    const groups = groupBillsByStatus(bills, referenceDate);
    expect(groups.paid.map((b) => b.id)).toEqual(['1']);
    expect(groups.overdue.map((b) => b.id)).toEqual(['2']);
    expect(groups['due-soon'].map((b) => b.id)).toEqual(['3', '4']);
    expect(groups.upcoming.map((b) => b.id)).toEqual(['5']);
  });
});

describe('filterBills', () => {
  it('filters by case-insensitive title or category match', () => {
    const result = filterBills(bills, 'electric', 'all', referenceDate);
    expect(result.map((b) => b.id)).toEqual(['3']);
  });

  it('filters by status', () => {
    const result = filterBills(bills, '', 'overdue', referenceDate);
    expect(result.map((b) => b.id)).toEqual(['2']);
  });

  it('returns all bills for an empty query and "all" status', () => {
    expect(filterBills(bills, '', 'all', referenceDate)).toHaveLength(5);
  });
});

describe('sortBills', () => {
  it('sorts by due date ascending', () => {
    const sorted = sortBills(bills, 'dueDate');
    expect(sorted.map((b) => b.id)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('sorts by amount descending', () => {
    const sorted = sortBills(bills, 'amount');
    expect(sorted.map((b) => b.id)).toEqual(['1', '2', '5', '3', '4']);
  });
});

describe('monthlyBillTotal', () => {
  it('sums amounts for bills due within the reference month', () => {
    expect(monthlyBillTotal(bills, referenceDate)).toBe(1450 + 320 + 85 + 60 + 145);
  });

  it('excludes bills outside the reference month', () => {
    const withNextMonth: Bill[] = [
      ...bills,
      { id: '6', title: 'Next Month Bill', category: 'Other', amount: 999, dueDate: '2026-09-01', recurrence: null, paid: false },
    ];
    expect(monthlyBillTotal(withNextMonth, referenceDate)).toBe(1450 + 320 + 85 + 60 + 145);
  });
});
