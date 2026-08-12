import { describe, expect, it } from 'vitest';
import { filterExpenses, totalExpenses, groupExpensesByCategory } from './expenses-selectors';
import type { Expense } from './expenses-repository';

const expenses: Expense[] = [
  { id: 'exp-1', categoryId: 'cat-1', category: 'Groceries', categoryColorSlot: 2, amount: 850, date: '2026-08-12', description: 'Weekly run', paymentMethod: 'Cash' },
  { id: 'exp-2', categoryId: 'cat-2', category: 'Transport', categoryColorSlot: 3, amount: 600, date: '2026-08-11', description: 'Gas', paymentMethod: null },
  { id: 'exp-3', categoryId: 'cat-1', category: 'Groceries', categoryColorSlot: 2, amount: 200, date: '2026-08-10', description: 'Snacks', paymentMethod: 'Cash' },
];

describe('filterExpenses', () => {
  it('returns everything when query is empty and category is all', () => {
    expect(filterExpenses(expenses, '', 'all')).toEqual(expenses);
  });

  it('matches the query against the description', () => {
    expect(filterExpenses(expenses, 'gas', 'all').map((e) => e.id)).toEqual(['exp-2']);
  });

  it('matches the query against the category name', () => {
    expect(filterExpenses(expenses, 'groceries', 'all').map((e) => e.id)).toEqual(['exp-1', 'exp-3']);
  });

  it('filters by category id', () => {
    expect(filterExpenses(expenses, '', 'cat-2').map((e) => e.id)).toEqual(['exp-2']);
  });
});

describe('totalExpenses', () => {
  it('sums every expense amount', () => {
    expect(totalExpenses(expenses)).toBe(1650);
  });

  it('returns 0 for an empty list', () => {
    expect(totalExpenses([])).toBe(0);
  });
});

describe('groupExpensesByCategory', () => {
  it('sums amounts per category, sorted by total descending', () => {
    expect(groupExpensesByCategory(expenses)).toEqual([
      { categoryId: 'cat-1', category: 'Groceries', categoryColorSlot: 2, total: 1050 },
      { categoryId: 'cat-2', category: 'Transport', categoryColorSlot: 3, total: 600 },
    ]);
  });

  it('returns an empty array for an empty list', () => {
    expect(groupExpensesByCategory([])).toEqual([]);
  });
});
