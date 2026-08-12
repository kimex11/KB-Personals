import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExpenseTile } from './ExpenseTile';
import type { Expense } from '@/lib/expenses-repository';

const expense: Expense = {
  id: 'exp-1',
  categoryId: 'cat-1',
  category: 'Groceries',
  categoryColorSlot: 2,
  amount: 850,
  date: '2026-08-12',
  description: 'Weekly run',
  paymentMethod: 'Cash',
};

describe('ExpenseTile', () => {
  it('shows description, category, amount, and date', () => {
    render(<ExpenseTile expense={expense} />);
    const tile = screen.getByTestId('expense-row');
    expect(tile).toHaveTextContent('Weekly run');
    expect(tile).toHaveTextContent('Groceries');
    expect(tile).toHaveTextContent('850.00');
    expect(tile).toHaveTextContent('Aug 12, 2026');
    expect(tile).toHaveTextContent('Cash');
  });

  it('falls back to the category name when no description is given', () => {
    render(<ExpenseTile expense={{ ...expense, description: null }} />);
    expect(screen.getByTestId('expense-row')).toHaveTextContent('Groceries');
  });

  it('tints the tile to match its category color', () => {
    render(<ExpenseTile expense={expense} />);
    expect(screen.getByTestId('expense-row')).toHaveClass('bg-budget-2/8');
  });

  it('does not render an actions menu when no handlers are given', () => {
    render(<ExpenseTile expense={expense} />);
    expect(screen.queryByRole('button', { name: /actions for weekly run/i })).not.toBeInTheDocument();
  });

  it('calls onEdit/onDelete via the actions menu', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<ExpenseTile expense={expense} onEdit={onEdit} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /actions for weekly run/i }));
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(expense);

    await user.click(screen.getByRole('button', { name: /actions for weekly run/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(expense);
  });
});
