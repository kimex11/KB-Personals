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
