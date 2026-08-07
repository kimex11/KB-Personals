import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardDueRow } from './CardDueRow';
import type { CreditCardDue } from '@/lib/accounts-types';

const referenceDate = new Date(2026, 7, 15);

const card: CreditCardDue = {
  id: '1',
  cardName: 'Visa Platinum',
  last4: '4821',
  statementBalance: 842.5,
  minimumPayment: 45,
  dueDate: '2026-08-16',
};

describe('CardDueRow', () => {
  it('shows card name, masked last 4 digits, statement balance, and minimum payment', () => {
    render(<CardDueRow card={card} referenceDate={referenceDate} />);
    const row = screen.getByTestId('card-due-row');
    expect(row).toHaveTextContent('Visa Platinum');
    expect(row).toHaveTextContent('••4821');
    expect(row).toHaveTextContent('₱842.50');
    expect(row).toHaveTextContent('₱45.00');
  });

  it('shows the due status badge', () => {
    render(<CardDueRow card={card} referenceDate={referenceDate} />);
    expect(screen.getByTestId('card-due-status-badge')).toBeInTheDocument();
  });
});
