'use client';

import { useMemo, useState } from 'react';
import type { Expense } from '@/lib/expenses-repository';
import { filterExpenses } from '@/lib/expenses-selectors';
import { ExpenseTile } from './ExpenseTile';
import { ExpensesFilterBar } from './ExpensesFilterBar';
import { EmptyState } from '@/components/shared/EmptyState';

interface ExpensesListProps {
  expenses: Expense[];
  categories: { id: string; name: string; colorSlot?: number }[];
  onEdit?: (expense: Expense) => void;
  onDelete?: (expense: Expense) => void;
}

export function ExpensesList({ expenses, categories, onEdit, onDelete }: ExpensesListProps) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const visibleExpenses = useMemo(
    () => filterExpenses(expenses, query, categoryFilter),
    [expenses, query, categoryFilter]
  );

  return (
    <div data-testid="expenses-list" className="flex flex-col gap-3">
      <ExpensesFilterBar
        query={query}
        onQueryChange={setQuery}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        categories={categories}
      />
      {visibleExpenses.length === 0 ? (
        <EmptyState message="No expenses match your filters." />
      ) : (
        <div className="flex flex-col gap-2">
          {visibleExpenses.map((expense) => (
            <ExpenseTile key={expense.id} expense={expense} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
