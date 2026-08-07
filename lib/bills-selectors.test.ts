import { describe, expect, it } from 'vitest';
import {
  getBillStatus,
  groupBillsByStatus,
  filterBills,
  sortBills,
  monthlyBillTotal,
  findDuplicateBillIds,
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

describe('findDuplicateBillIds', () => {
  it('flags two unpaid bills with the same title, amount, and nearby due dates', () => {
    const withDuplicate: Bill[] = [
      ...bills,
      { id: '7', title: 'Electricity', category: 'Utilities', amount: 85, dueDate: '2026-08-16', recurrence: null, paid: false },
    ];
    const duplicates = findDuplicateBillIds(withDuplicate);
    expect(duplicates.has('3')).toBe(true);
    expect(duplicates.has('7')).toBe(true);
  });

  it('does not flag bills with different amounts', () => {
    const notDuplicate: Bill[] = [
      ...bills,
      { id: '8', title: 'Electricity', category: 'Utilities', amount: 95, dueDate: '2026-08-16', recurrence: null, paid: false },
    ];
    const duplicates = findDuplicateBillIds(notDuplicate);
    expect(duplicates.has('3')).toBe(false);
    expect(duplicates.has('8')).toBe(false);
  });

  it('does not flag bills whose due dates are far apart', () => {
    const notDuplicate: Bill[] = [
      ...bills,
      { id: '9', title: 'Electricity', category: 'Utilities', amount: 85, dueDate: '2026-09-01', recurrence: null, paid: false },
    ];
    const duplicates = findDuplicateBillIds(notDuplicate);
    expect(duplicates.has('3')).toBe(false);
    expect(duplicates.has('9')).toBe(false);
  });

  it('ignores paid bills when checking for duplicates', () => {
    const withPaidMatch: Bill[] = [
      ...bills,
      { id: '10', title: 'Rent', category: 'Housing', amount: 1450, dueDate: '2026-08-02', recurrence: null, paid: false },
    ];
    // bill '1' (Rent) is paid, so this shouldn't count '1' as a duplicate partner, but the
    // new unpaid one has no other unpaid match either, so nothing should be flagged.
    const duplicates = findDuplicateBillIds(withPaidMatch);
    expect(duplicates.has('1')).toBe(false);
    expect(duplicates.has('10')).toBe(false);
  });

  it('is case-insensitive and trims whitespace when comparing titles', () => {
    const withDuplicate: Bill[] = [
      ...bills,
      { id: '11', title: '  electricity  ', category: 'Utilities', amount: 85, dueDate: '2026-08-16', recurrence: null, paid: false },
    ];
    const duplicates = findDuplicateBillIds(withDuplicate);
    expect(duplicates.has('3')).toBe(true);
    expect(duplicates.has('11')).toBe(true);
  });

  it('returns an empty set when there are no duplicates', () => {
    expect(findDuplicateBillIds(bills).size).toBe(0);
  });
});
