import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExpensesList } from './ExpensesList';
import type { Expense } from '@/lib/expenses-repository';

const expenses: Expense[] = [
  { id: 'exp-1', categoryId: 'cat-1', category: 'Groceries', categoryColorSlot: 2, amount: 850, date: '2026-08-12', description: 'Weekly run', paymentMethod: 'Cash' },
  { id: 'exp-2', categoryId: 'cat-2', category: 'Transport', categoryColorSlot: 3, amount: 600, date: '2026-08-11', description: 'Gas', paymentMethod: null },
];

const categories = [
  { id: 'cat-1', name: 'Groceries' },
  { id: 'cat-2', name: 'Transport' },
];

describe('ExpensesList', () => {
  it('shows an empty state when there are no expenses', () => {
    render(<ExpensesList expenses={[]} categories={categories} />);
    expect(screen.getByTestId('empty-state')).toHaveTextContent('No expenses match your filters.');
  });

  it('renders one tile per expense', () => {
    render(<ExpensesList expenses={expenses} categories={categories} />);
    expect(screen.getAllByTestId('expense-row')).toHaveLength(2);
  });

  it('filters by search query', () => {
    render(<ExpensesList expenses={expenses} categories={categories} />);
    fireEvent.change(screen.getByTestId('expenses-search-input'), { target: { value: 'gas' } });
    expect(screen.getAllByTestId('expense-row')).toHaveLength(1);
  });

  it('filters by category', () => {
    render(<ExpensesList expenses={expenses} categories={categories} />);
    fireEvent.change(screen.getByTestId('expenses-category-select'), { target: { value: 'cat-2' } });
    expect(screen.getAllByTestId('expense-row')).toHaveLength(1);
  });

  it('passes onEdit/onDelete through to each tile', async () => {
    render(<ExpensesList expenses={expenses} categories={categories} onEdit={() => {}} onDelete={() => {}} />);
    expect(screen.getAllByRole('button', { name: /^actions for /i })).toHaveLength(2);
  });
});
