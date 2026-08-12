import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IncomeForm } from './IncomeForm';
import type { IncomeSource } from '@/lib/accounts-types';

const existingIncome: IncomeSource = {
  id: 'income-1',
  name: 'Salary',
  amount: 3200,
  frequency: 'biweekly',
  nextDate: '2026-08-20',
};

describe('IncomeForm', () => {
  it('renders empty fields for a new income source', () => {
    render(<IncomeForm open onOpenChange={() => {}} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/^name$/i)).toHaveValue('');
    expect(screen.getByRole('heading', { name: /add income/i })).toBeInTheDocument();
  });

  it('pre-fills fields when editing an existing income source', () => {
    render(<IncomeForm open onOpenChange={() => {}} initialIncome={existingIncome} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/^name$/i)).toHaveValue('Salary');
    expect(screen.getByLabelText(/amount/i)).toHaveValue('3,200');
    expect(screen.getByLabelText(/frequency/i)).toHaveValue('biweekly');
    expect(screen.getByLabelText(/next date/i)).toHaveValue('2026-08-20');
    expect(screen.getByRole('heading', { name: /edit income/i })).toBeInTheDocument();
  });

  it('disables save until required fields are filled', async () => {
    const user = userEvent.setup();
    render(<IncomeForm open onOpenChange={() => {}} onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/^name$/i), 'Salary');
    await user.type(screen.getByLabelText(/amount/i), '3200');
    await user.type(screen.getByLabelText(/next date/i), '2026-08-20');
    expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
  });

  it('calls onSubmit with the entered values, defaulting frequency to monthly', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<IncomeForm open onOpenChange={() => {}} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^name$/i), 'Salary');
    await user.type(screen.getByLabelText(/amount/i), '3200');
    await user.type(screen.getByLabelText(/next date/i), '2026-08-20');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledWith({ name: 'Salary', amount: 3200, frequency: 'monthly', nextDate: '2026-08-20' });
  });

  it('calls onSubmit with the selected frequency', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<IncomeForm open onOpenChange={() => {}} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^name$/i), 'Salary');
    await user.selectOptions(screen.getByLabelText(/frequency/i), 'biweekly');
    await user.type(screen.getByLabelText(/amount/i), '3200');
    await user.type(screen.getByLabelText(/next date/i), '2026-08-20');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledWith({ name: 'Salary', amount: 3200, frequency: 'biweekly', nextDate: '2026-08-20' });
  });
});
