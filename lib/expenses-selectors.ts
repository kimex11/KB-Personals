import type { Expense } from './expenses-repository';

export function filterExpenses(expenses: Expense[], query: string, categoryFilter: string): Expense[] {
  const q = query.trim().toLowerCase();
  return expenses.filter((expense) => {
    const matchesQuery = q === '' || (expense.description ?? '').toLowerCase().includes(q) || expense.category.toLowerCase().includes(q);
    const matchesCategory = categoryFilter === 'all' || expense.categoryId === categoryFilter;
    return matchesQuery && matchesCategory;
  });
}

export function totalExpenses(expenses: Expense[]): number {
  return expenses.reduce((sum, expense) => sum + expense.amount, 0);
}

export interface ExpenseCategoryGroup {
  categoryId: string;
  category: string;
  categoryColorSlot: number;
  total: number;
}

export function groupExpensesByCategory(expenses: Expense[]): ExpenseCategoryGroup[] {
  const groups = new Map<string, ExpenseCategoryGroup>();
  for (const expense of expenses) {
    const existing = groups.get(expense.categoryId);
    if (existing) {
      existing.total += expense.amount;
    } else {
      groups.set(expense.categoryId, {
        categoryId: expense.categoryId,
        category: expense.category,
        categoryColorSlot: expense.categoryColorSlot,
        total: expense.amount,
      });
    }
  }
  return [...groups.values()].sort((a, b) => b.total - a.total);
}
