import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaymentHistoryList } from './PaymentHistoryList';
import type { CreditCardPayment } from '@/lib/credit-card-payments-repository';

const payments: CreditCardPayment[] = [
  { id: 'pay-2', cardId: 'card-1', amount: 300, balanceBefore: 542.5, balanceAfter: 242.5, paidAt: '2026-08-10T10:00:00.000Z', method: null, notes: null },
  { id: 'pay-1', cardId: 'card-1', amount: 400, balanceBefore: 942.5, balanceAfter: 542.5, paidAt: '2026-07-28T09:00:00.000Z', method: null, notes: null },
];

describe('PaymentHistoryList', () => {
  it('shows an empty state when there are no payments', () => {
    render(<PaymentHistoryList payments={[]} />);
    expect(screen.getByTestId('empty-state')).toHaveTextContent('No payments recorded yet.');
  });

  it('renders one entry per payment, in the order given', () => {
    render(<PaymentHistoryList payments={payments} />);
    const entries = screen.getAllByTestId('payment-history-entry');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent('300.00');
    expect(entries[1]).toHaveTextContent('400.00');
  });
});
