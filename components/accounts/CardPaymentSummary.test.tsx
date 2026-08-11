import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardPaymentSummary } from './CardPaymentSummary';

describe('CardPaymentSummary', () => {
  it('shows remaining balance, total paid, and payment count', () => {
    render(
      <CardPaymentSummary
        remainingBalance={542.5}
        totalPaid={700}
        paymentsMade={2}
        lastPaymentDate="2026-08-10T10:00:00.000Z"
        nextDueDate="2026-08-16"
      />
    );
    expect(screen.getByTestId('summary-remaining-balance')).toHaveTextContent('542.50');
    expect(screen.getByTestId('summary-total-paid')).toHaveTextContent('700.00');
    expect(screen.getByTestId('summary-payments-made')).toHaveTextContent('2');
  });

  it('formats the last payment date and next due date', () => {
    render(
      <CardPaymentSummary
        remainingBalance={542.5}
        totalPaid={700}
        paymentsMade={2}
        lastPaymentDate="2026-08-10T10:00:00.000Z"
        nextDueDate="2026-08-16"
      />
    );
    expect(screen.getByTestId('summary-last-payment')).toHaveTextContent('Aug 10, 2026');
    expect(screen.getByTestId('summary-next-due-date')).toHaveTextContent('Aug 16, 2026');
  });

  it('shows a placeholder when there is no last payment yet', () => {
    render(
      <CardPaymentSummary
        remainingBalance={842.5}
        totalPaid={0}
        paymentsMade={0}
        lastPaymentDate={null}
        nextDueDate="2026-08-16"
      />
    );
    expect(screen.getByTestId('summary-last-payment')).toHaveTextContent('No payments yet');
  });
});
