import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanPaymentForm } from './PlanPaymentForm';

describe('PlanPaymentForm', () => {
  it('defaults the amount to the plan monthly amount and disables save until a paid-on date is set', () => {
    render(<PlanPaymentForm open onOpenChange={() => {}} defaultAmount={3000} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/amount/i)).toHaveValue('3,000');
    expect(screen.getByRole('button', { name: /record payment/i })).not.toBeDisabled();
  });

  it('rejects a zero or negative amount', async () => {
    const user = userEvent.setup();
    render(<PlanPaymentForm open onOpenChange={() => {}} defaultAmount={3000} onSubmit={vi.fn()} />);
    const amountInput = screen.getByLabelText(/amount/i);
    await user.clear(amountInput);
    await user.type(amountInput, '0');
    expect(screen.getByRole('button', { name: /record payment/i })).toBeDisabled();
  });

  it('submits the amount and an ISO paid-at timestamp', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<PlanPaymentForm open onOpenChange={() => {}} defaultAmount={3000} onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: /record payment/i }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ amount: 3000 }));
  });
});
