import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanPaymentHistoryEntry } from './PlanPaymentHistoryEntry';
import type { PaymentPlanPayment } from '@/lib/payment-plan-payments-repository';

const payment: PaymentPlanPayment = {
  id: 'pp-1',
  planId: 'plan-1',
  installmentNumber: 2,
  amount: 3000,
  balanceBefore: 33000,
  balanceAfter: 30000,
  paidAt: '2026-02-01T10:00:00.000Z',
};

describe('PlanPaymentHistoryEntry', () => {
  it('shows the installment number, amount, and balance trail', () => {
    render(<PlanPaymentHistoryEntry payment={payment} installmentCount={12} />);
    const entry = screen.getByTestId('plan-payment-history-entry');
    expect(entry).toHaveTextContent('Installment 2 of 12');
    expect(entry).toHaveTextContent('3,000.00');
    expect(screen.getByTestId('plan-payment-balance-trail')).toHaveTextContent('33,000.00');
    expect(screen.getByTestId('plan-payment-balance-trail')).toHaveTextContent('30,000.00');
  });

  it('calls onEdit/onDelete via the actions menu', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<PlanPaymentHistoryEntry payment={payment} installmentCount={12} onEdit={onEdit} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /actions for/i }));
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(payment);

    await user.click(screen.getByRole('button', { name: /actions for/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(payment);
  });

  it('omits the actions menu when no handlers are given', () => {
    render(<PlanPaymentHistoryEntry payment={payment} installmentCount={12} />);
    expect(screen.queryByRole('button', { name: /actions for/i })).not.toBeInTheDocument();
  });
});
