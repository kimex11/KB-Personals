import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardDueTile } from './CardDueTile';
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

describe('CardDueTile', () => {
  it('shows card name, masked last 4 digits, statement balance, and minimum payment', () => {
    render(<CardDueTile card={card} referenceDate={referenceDate} />);
    const tile = screen.getByTestId('card-due-row');
    expect(tile).toHaveTextContent('Visa Platinum');
    expect(tile).toHaveTextContent('••4821');
    expect(tile).toHaveTextContent('₱842.50');
    expect(tile).toHaveTextContent('₱45.00');
  });

  it('shows the due status badge', () => {
    render(<CardDueTile card={card} referenceDate={referenceDate} />);
    expect(screen.getByTestId('card-due-status-badge')).toBeInTheDocument();
  });

  it('tints the balance and card background to match status: overdue', () => {
    const overdue: CreditCardDue = { ...card, dueDate: '2026-08-01' };
    render(<CardDueTile card={overdue} referenceDate={referenceDate} />);
    expect(screen.getByTestId('card-due-balance')).toHaveClass('text-status-critical');
    expect(screen.getByTestId('card-due-row')).toHaveClass('bg-status-critical/10');
  });

  it('tints the balance to match status: due-soon', () => {
    const dueSoon: CreditCardDue = { ...card, dueDate: '2026-08-16' };
    render(<CardDueTile card={dueSoon} referenceDate={referenceDate} />);
    expect(screen.getByTestId('card-due-balance')).toHaveClass('text-status-warning');
    expect(screen.getByTestId('card-due-row')).toHaveClass('bg-status-warning/10');
  });

  it('uses a neutral gray background for status: upcoming', () => {
    const upcoming: CreditCardDue = { ...card, dueDate: '2026-09-30' };
    render(<CardDueTile card={upcoming} referenceDate={referenceDate} />);
    expect(screen.getByTestId('card-due-row')).toHaveClass('bg-neutral-100');
  });

  it('does not render an actions menu when no handlers are given', () => {
    render(<CardDueTile card={card} referenceDate={referenceDate} />);
    expect(screen.queryByRole('button', { name: /actions for visa platinum/i })).not.toBeInTheDocument();
  });

  it('calls onEdit/onDelete via the actions menu', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<CardDueTile card={card} referenceDate={referenceDate} onEdit={onEdit} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /actions for visa platinum/i }));
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(card);

    await user.click(screen.getByRole('button', { name: /actions for visa platinum/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(card);
  });

  it('links to the card detail page', () => {
    render(<CardDueTile card={card} referenceDate={referenceDate} />);
    expect(screen.getByTestId('card-view-history-link')).toHaveAttribute('href', '/accounts/cards/1');
  });
});
