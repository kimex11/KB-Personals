import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardDueForm } from './CardDueForm';
import type { CreditCardDue } from '@/lib/accounts-types';

const existingCard: CreditCardDue = {
  id: 'card-1',
  cardName: 'Visa Platinum',
  last4: '4821',
  statementBalance: 842.5,
  minimumPayment: 45,
  dueDate: '2026-08-16',
  balanceAnchorAt: '2026-08-01T00:00:00.000Z',
};

describe('CardDueForm', () => {
  it('renders empty fields for a new card', () => {
    render(<CardDueForm open onOpenChange={() => {}} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/card name/i)).toHaveValue('');
    expect(screen.getByRole('heading', { name: /add credit card/i })).toBeInTheDocument();
  });

  it('pre-fills fields when editing an existing card', () => {
    render(<CardDueForm open onOpenChange={() => {}} initialCard={existingCard} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/card name/i)).toHaveValue('Visa Platinum');
    expect(screen.getByLabelText(/last 4 digits/i)).toHaveValue('4821');
    expect(screen.getByLabelText(/statement balance/i)).toHaveValue('842.5');
    expect(screen.getByLabelText(/minimum payment/i)).toHaveValue('45');
    expect(screen.getByLabelText(/due date/i)).toHaveValue('2026-08-16');
    expect(screen.getByRole('heading', { name: /edit credit card/i })).toBeInTheDocument();
  });

  it('disables save until required fields are filled', async () => {
    const user = userEvent.setup();
    render(<CardDueForm open onOpenChange={() => {}} onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/card name/i), 'Visa Platinum');
    await user.type(screen.getByLabelText(/last 4 digits/i), '4821');
    await user.type(screen.getByLabelText(/statement balance/i), '842.5');
    await user.type(screen.getByLabelText(/minimum payment/i), '45');
    await user.type(screen.getByLabelText(/due date/i), '2026-08-16');
    expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
  });

  it('calls onSubmit with the entered values', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CardDueForm open onOpenChange={() => {}} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/card name/i), 'Visa Platinum');
    await user.type(screen.getByLabelText(/last 4 digits/i), '4821');
    await user.type(screen.getByLabelText(/statement balance/i), '842.5');
    await user.type(screen.getByLabelText(/minimum payment/i), '45');
    await user.type(screen.getByLabelText(/due date/i), '2026-08-16');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      cardName: 'Visa Platinum',
      last4: '4821',
      statementBalance: 842.5,
      minimumPayment: 45,
      dueDate: '2026-08-16',
    });
  });
});
