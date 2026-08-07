import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IncomeRow } from './IncomeRow';
import type { IncomeSource } from '@/lib/accounts-types';

const referenceDate = new Date(2026, 7, 15);

const source: IncomeSource = {
  id: '1',
  name: 'Salary',
  amount: 3200,
  frequency: 'biweekly',
  nextDate: '2026-08-20',
};

describe('IncomeRow', () => {
  it('shows name, amount, frequency, and next date', () => {
    render(<IncomeRow source={source} referenceDate={referenceDate} />);
    const row = screen.getByTestId('income-row');
    expect(row).toHaveTextContent('Salary');
    expect(row).toHaveTextContent('₱3200.00');
    expect(row).toHaveTextContent('Biweekly');
  });

  it('calls onEdit/onDelete when the action buttons are clicked', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<IncomeRow source={source} referenceDate={referenceDate} onEdit={onEdit} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /edit salary/i }));
    expect(onEdit).toHaveBeenCalledWith(source);

    await user.click(screen.getByRole('button', { name: /delete salary/i }));
    expect(onDelete).toHaveBeenCalledWith(source);
  });
});
