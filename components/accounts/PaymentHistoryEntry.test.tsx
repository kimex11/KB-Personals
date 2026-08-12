import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaymentHistoryEntry } from './PaymentHistoryEntry';
import type { CreditCardPayment } from '@/lib/credit-card-payments-repository';

const payment: CreditCardPayment = {
  id: 'pay-1', cardId: 'card-1', amount: 300, balanceBefore: 842.5, balanceAfter: 542.5, paidAt: '2026-08-10T10:00:00.000Z', method: 'Bank transfer', notes: 'Paid from savings',
};

describe('PaymentHistoryEntry', () => {
  it('shows the amount, balance trail, and timestamp', () => {
    render(<PaymentHistoryEntry payment={payment} />);
    const entry = screen.getByTestId('payment-history-entry');
    expect(entry).toHaveTextContent('300.00');
    expect(screen.getByTestId('payment-balance-trail')).toHaveTextContent('842.50');
    expect(screen.getByTestId('payment-balance-trail')).toHaveTextContent('542.50');
  });

  it('shows method and notes when present', () => {
    render(<PaymentHistoryEntry payment={payment} />);
    expect(screen.getByText('Bank transfer')).toBeInTheDocument();
    expect(screen.getByTestId('payment-notes')).toHaveTextContent('Paid from savings');
  });

  it('omits notes when absent', () => {
    render(<PaymentHistoryEntry payment={{ ...payment, notes: null }} />);
    expect(screen.queryByTestId('payment-notes')).not.toBeInTheDocument();
  });

  it('calls onEdit/onDelete via the actions menu', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<PaymentHistoryEntry payment={payment} onEdit={onEdit} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /actions for/i }));
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(payment);

    await user.click(screen.getByRole('button', { name: /actions for/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(payment);
  });

  it('omits the actions menu when no handlers are given', () => {
    render(<PaymentHistoryEntry payment={payment} />);
    expect(screen.queryByRole('button', { name: /actions for/i })).not.toBeInTheDocument();
  });
});
