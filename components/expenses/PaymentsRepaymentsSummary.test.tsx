import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaymentsRepaymentsSummary } from './PaymentsRepaymentsSummary';

describe('PaymentsRepaymentsSummary', () => {
  it('shows bills paid and card repayments totals with counts', () => {
    render(<PaymentsRepaymentsSummary billsPaidTotal={4350} billsPaidCount={3} repaymentsTotal={1200} repaymentsCount={4} />);
    expect(screen.getByTestId('summary-bills-paid')).toHaveTextContent('4,350.00');
    expect(screen.getByTestId('summary-bills-paid')).toHaveTextContent('3');
    expect(screen.getByTestId('summary-repayments')).toHaveTextContent('1,200.00');
    expect(screen.getByTestId('summary-repayments')).toHaveTextContent('4');
  });
});
