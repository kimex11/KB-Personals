import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaymentPlanTile } from './PaymentPlanTile';
import type { PaymentPlan } from '@/lib/payment-plans-repository';
import type { PaymentPlanPayment } from '@/lib/payment-plan-payments-repository';

const plan: PaymentPlan = {
  id: 'plan-1',
  name: 'iPhone 15',
  categoryId: 'cat-1',
  category: 'Electronics',
  categoryColorSlot: 4,
  totalAmount: 36000,
  installmentCount: 12,
  monthlyAmount: 3000,
  startDate: '2026-01-01',
};

const payments: PaymentPlanPayment[] = [
  { id: 'pp-1', planId: 'plan-1', installmentNumber: 1, amount: 3000, balanceBefore: 36000, balanceAfter: 33000, paidAt: '2026-01-01T10:00:00.000Z' },
];

describe('PaymentPlanTile', () => {
  it('shows the plan name, category, months paid, and remaining balance', () => {
    render(<PaymentPlanTile plan={plan} payments={payments} />);
    expect(screen.getByText('iPhone 15')).toBeInTheDocument();
    expect(screen.getByTestId('payment-plan-row')).toHaveTextContent('Electronics');
    expect(screen.getByTestId('payment-plan-row')).toHaveTextContent('1 of 12 paid');
    expect(screen.getByTestId('payment-plan-row')).toHaveTextContent('33,000');
  });

  it('links to the plan detail page', () => {
    render(<PaymentPlanTile plan={plan} payments={payments} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/budget/plans/plan-1');
  });
});
