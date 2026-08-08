import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('colors the balance and left border to match status: overdue', () => {
    const overdue: CreditCardDue = { ...card, dueDate: '2026-08-01' };
    render(<CardDueRow card={overdue} referenceDate={referenceDate} />);
    expect(screen.getByTestId('card-due-balance')).toHaveClass('text-status-critical');
    expect(screen.getByTestId('card-due-row')).toHaveClass('border-l-status-critical');
  });

  it('colors the balance and left border to match status: due-soon', () => {
    const dueSoon: CreditCardDue = { ...card, dueDate: '2026-08-16' };
    render(<CardDueRow card={dueSoon} referenceDate={referenceDate} />);
    expect(screen.getByTestId('card-due-balance')).toHaveClass('text-status-warning');
    expect(screen.getByTestId('card-due-row')).toHaveClass('border-l-status-warning');
  });

  it('does not render an actions menu when no handlers are given', () => {
    render(<CardDueRow card={card} referenceDate={referenceDate} />);
    expect(screen.queryByRole('button', { name: /actions for visa platinum/i })).not.toBeInTheDocument();
  });

  it('calls onEdit/onDelete via the actions menu', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<CardDueRow card={card} referenceDate={referenceDate} onEdit={onEdit} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /actions for visa platinum/i }));
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(card);

    await user.click(screen.getByRole('button', { name: /actions for visa platinum/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(card);
  });
});
