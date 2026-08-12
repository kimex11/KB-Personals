import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaymentPlansList } from './PaymentPlansList';
import type { PaymentPlan } from '@/lib/payment-plans-repository';
import type { PaymentPlanPayment } from '@/lib/payment-plan-payments-repository';

const plans: PaymentPlan[] = [
  { id: 'plan-1', name: 'iPhone 15', categoryId: 'cat-1', category: 'Electronics', categoryColorSlot: 4, totalAmount: 36000, installmentCount: 12, monthlyAmount: 3000, startDate: '2026-01-01' },
];

describe('PaymentPlansList', () => {
  it('renders one tile per plan', () => {
    render(<PaymentPlansList plans={plans} paymentsByPlanId={{ 'plan-1': [] as PaymentPlanPayment[] }} />);
    expect(screen.getAllByTestId('payment-plan-row')).toHaveLength(1);
  });

  it('shows an empty state when there are no plans', () => {
    render(<PaymentPlansList plans={[]} paymentsByPlanId={{}} />);
    expect(screen.getByText(/no payment plans yet/i)).toBeInTheDocument();
  });
});
