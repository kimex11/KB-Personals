import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IncomeTile } from './IncomeTile';
import type { IncomeSource } from '@/lib/accounts-types';

const referenceDate = new Date(2026, 7, 15);

const source: IncomeSource = {
  id: '1',
  name: 'Salary',
  amount: 3200,
  date: '2026-08-20',
};

describe('IncomeTile', () => {
  it('shows name, amount, and a plain date', () => {
    render(<IncomeTile source={source} referenceDate={referenceDate} />);
    const tile = screen.getByTestId('income-row');
    expect(tile).toHaveTextContent('Salary');
    expect(tile).toHaveTextContent('₱3,200.00');
    expect(tile).toHaveTextContent('Aug 20, 2026');
  });

  it('tints the card background success-green', () => {
    render(<IncomeTile source={source} referenceDate={referenceDate} />);
    expect(screen.getByTestId('income-row')).toHaveClass('bg-status-success/10');
  });

  it('calls onEdit/onDelete via the actions menu', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<IncomeTile source={source} referenceDate={referenceDate} onEdit={onEdit} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /actions for salary/i }));
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(source);

    await user.click(screen.getByRole('button', { name: /actions for salary/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(source);
  });
});
