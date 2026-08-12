import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlanProgressSummary } from './PlanProgressSummary';

describe('PlanProgressSummary', () => {
  it('shows total amount, remaining balance, total paid, payments made, and last payment', () => {
    render(
      <PlanProgressSummary
        totalAmount={36000}
        remainingBalance={30000}
        totalPaid={6000}
        monthsPaid={2}
        installmentCount={12}
        lastPaymentDate="2026-02-01T10:00:00.000Z"
      />
    );
    expect(screen.getByTestId('summary-total-amount')).toHaveTextContent('36,000');
    expect(screen.getByTestId('summary-remaining-balance')).toHaveTextContent('30,000');
    expect(screen.getByTestId('summary-total-paid')).toHaveTextContent('6,000');
    expect(screen.getByTestId('summary-payments-made')).toHaveTextContent('2 of 12 (10 left)');
    expect(screen.getByTestId('summary-last-payment')).toHaveTextContent('Feb 1, 2026');
  });

  it('shows "No payments yet" when there is no last payment date', () => {
    render(<PlanProgressSummary totalAmount={36000} remainingBalance={36000} totalPaid={0} monthsPaid={0} installmentCount={12} lastPaymentDate={null} />);
    expect(screen.getByTestId('summary-last-payment')).toHaveTextContent('No payments yet');
  });
});
