import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CardDetailPage from './page';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'card-1' }),
}));

const card = {
  id: 'card-1',
  cardName: 'Visa Platinum',
  last4: '4821',
  statementBalance: 542.5,
  minimumPayment: 45,
  dueDate: '2026-08-16',
  balanceAnchorAt: '2026-08-01T00:00:00.000Z',
};

const { useAccountsMock, useCardPaymentsMock, recordPaymentMock, updatePaymentMock, deletePaymentMock } = vi.hoisted(() => ({
  useAccountsMock: vi.fn(),
  useCardPaymentsMock: vi.fn(),
  recordPaymentMock: vi.fn().mockResolvedValue(undefined),
  updatePaymentMock: vi.fn().mockResolvedValue(undefined),
  deletePaymentMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/use-accounts', () => ({ useAccounts: useAccountsMock }));
vi.mock('@/lib/use-card-payments', () => ({ useCardPayments: useCardPaymentsMock }));

const payment = { id: 'pay-1', cardId: 'card-1', amount: 300, balanceBefore: 842.5, balanceAfter: 542.5, paidAt: '2026-08-10T10:00:00.000Z', method: 'Bank transfer', notes: null };

function mockDefaults(payments: typeof payment[] = [payment]) {
  useAccountsMock.mockReturnValue({ cards: [card], incomeSources: [], loading: false, error: null });
  useCardPaymentsMock.mockReturnValue({
    payments,
    loading: false,
    error: null,
    recordPayment: recordPaymentMock,
    updatePayment: updatePaymentMock,
    deletePayment: deletePaymentMock,
  });
}

describe('CardDetailPage', () => {
  it('shows the card name, summary, and payment history', async () => {
    mockDefaults();

    render(<CardDetailPage />);

    expect(screen.getByText('Visa Platinum')).toBeInTheDocument();
    expect(screen.getByTestId('card-payment-summary')).toBeInTheDocument();
    expect(screen.getByTestId('payment-history-entry')).toBeInTheDocument();
  });

  it("shows the remaining balance derived from the card's statement balance minus payments", () => {
    mockDefaults();
    render(<CardDetailPage />);
    expect(screen.getByTestId('summary-remaining-balance')).toHaveTextContent('242.50');
  });

  it('shows a not-found message when no card matches the route id', async () => {
    useAccountsMock.mockReturnValue({ cards: [], incomeSources: [], loading: false, error: null });
    useCardPaymentsMock.mockReturnValue({ payments: [], loading: false, error: null, recordPayment: recordPaymentMock, updatePayment: updatePaymentMock, deletePayment: deletePaymentMock });

    render(<CardDetailPage />);

    expect(screen.getByTestId('card-not-found')).toBeInTheDocument();
  });

  it('opens the Record Payment form and submits through the hook', async () => {
    mockDefaults([]);
    const user = userEvent.setup();

    render(<CardDetailPage />);
    await user.click(screen.getByRole('button', { name: /record payment/i }));
    await user.type(screen.getByLabelText(/^amount$/i), '150');
    await user.click(screen.getByRole('button', { name: /^record payment$/i }));

    await waitFor(() => expect(recordPaymentMock).toHaveBeenCalledWith(expect.objectContaining({ amount: 150 })));
  });

  it('opens the Edit form pre-filled and submits through updatePayment', async () => {
    mockDefaults();
    const user = userEvent.setup();

    render(<CardDetailPage />);
    await user.click(screen.getByRole('button', { name: /actions for/i }));
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }));

    expect(screen.getByLabelText(/^amount$/i)).toHaveValue('300');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(updatePaymentMock).toHaveBeenCalledWith('pay-1', expect.objectContaining({ amount: 300 })));
  });

  it('deletes a payment after confirming', async () => {
    mockDefaults();
    const user = userEvent.setup();

    render(<CardDetailPage />);
    await user.click(screen.getByRole('button', { name: /actions for/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(deletePaymentMock).toHaveBeenCalledWith('pay-1');
  });
});
