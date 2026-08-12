import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaymentPlanForm } from './PaymentPlanForm';

const categories = [{ id: 'cat-1', name: 'Electronics' }];

describe('PaymentPlanForm', () => {
  it('renders empty fields defaulting to today', () => {
    render(<PaymentPlanForm open onOpenChange={() => {}} categories={categories} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/plan name/i)).toHaveValue('');
    expect(screen.getByLabelText(/total amount/i)).toHaveValue('');
    expect(screen.getByLabelText(/number of installments/i)).toHaveValue(null);
  });

  it('disables save until name, total amount, installment count, and monthly amount are set', async () => {
    const user = userEvent.setup();
    render(<PaymentPlanForm open onOpenChange={() => {}} categories={categories} onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();

    await user.type(screen.getByLabelText(/plan name/i), 'iPhone 15');
    await user.type(screen.getByLabelText(/total amount/i), '36000');
    await user.type(screen.getByLabelText(/number of installments/i), '12');
    await user.type(screen.getByLabelText(/monthly amount/i), '3000');

    expect(screen.getByRole('button', { name: /^save$/i })).not.toBeDisabled();
  });

  it('submits with parsed numeric values', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<PaymentPlanForm open onOpenChange={() => {}} categories={categories} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/plan name/i), 'iPhone 15');
    await user.type(screen.getByLabelText(/total amount/i), '36000');
    await user.type(screen.getByLabelText(/number of installments/i), '12');
    await user.type(screen.getByLabelText(/monthly amount/i), '3000');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'iPhone 15', categoryId: 'cat-1', totalAmount: 36000, installmentCount: 12, monthlyAmount: 3000 })
    );
  });
});
