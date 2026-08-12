import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExpenseForm } from './ExpenseForm';
import type { Expense } from '@/lib/expenses-repository';

const categories = [
  { id: 'cat-1', name: 'Groceries' },
  { id: 'cat-2', name: 'Transport' },
];

const existingExpense: Expense = {
  id: 'exp-1',
  categoryId: 'cat-2',
  category: 'Transport',
  categoryColorSlot: 3,
  amount: 600,
  date: '2026-08-11',
  description: 'Gas',
  paymentMethod: 'Debit card',
};

describe('ExpenseForm', () => {
  it('renders empty fields for a new expense, defaulting to today', () => {
    render(<ExpenseForm open onOpenChange={() => {}} categories={categories} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/amount/i)).toHaveValue(null);
    expect(screen.getByLabelText(/description/i)).toHaveValue('');
    expect(screen.getByRole('heading', { name: /add expense/i })).toBeInTheDocument();
  });

  it('pre-fills fields when editing an existing expense', () => {
    render(<ExpenseForm open onOpenChange={() => {}} categories={categories} initialExpense={existingExpense} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/amount/i)).toHaveValue(600);
    expect(screen.getByLabelText(/date/i)).toHaveValue('2026-08-11');
    expect(screen.getByLabelText(/description/i)).toHaveValue('Gas');
    expect(screen.getByLabelText(/payment method/i)).toHaveValue('Debit card');
    expect(screen.getByRole('heading', { name: /edit expense/i })).toBeInTheDocument();
  });

  it('disables save until category, amount, and date are set', async () => {
    const user = userEvent.setup();
    render(<ExpenseForm open onOpenChange={() => {}} categories={categories} onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/amount/i), '850');
    expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
  });

  it('calls onSubmit with the entered values', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ExpenseForm open onOpenChange={() => {}} categories={categories} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'cat-1' } });
    await user.type(screen.getByLabelText(/amount/i), '850');
    fireEvent.change(screen.getByLabelText(/date/i), { target: { value: '2026-08-12' } });
    await user.type(screen.getByLabelText(/description/i), 'Weekly run');
    await user.type(screen.getByLabelText(/payment method/i), 'Cash');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      categoryId: 'cat-1',
      amount: 850,
      date: '2026-08-12',
      description: 'Weekly run',
      paymentMethod: 'Cash',
    });
  });
});
