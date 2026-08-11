import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CardDetailPage from './page';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'card-1' }),
}));

const card = { id: 'card-1', cardName: 'Visa Platinum', last4: '4821', statementBalance: 542.5, minimumPayment: 45, dueDate: '2026-08-16' };

const { useAccountsMock, useCardPaymentsMock, recordPaymentMock } = vi.hoisted(() => ({
  useAccountsMock: vi.fn(),
  useCardPaymentsMock: vi.fn(),
  recordPaymentMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/use-accounts', () => ({ useAccounts: useAccountsMock }));
vi.mock('@/lib/use-card-payments', () => ({ useCardPayments: useCardPaymentsMock }));

const payment = { id: 'pay-1', cardId: 'card-1', amount: 300, balanceBefore: 842.5, balanceAfter: 542.5, paidAt: '2026-08-10T10:00:00.000Z', method: 'Bank transfer', notes: null };

describe('CardDetailPage', () => {
  it('shows the card name, summary, and payment history', async () => {
    useAccountsMock.mockReturnValue({ cards: [card], incomeSources: [], loading: false, error: null });
    useCardPaymentsMock.mockReturnValue({ payments: [payment], loading: false, error: null, recordPayment: recordPaymentMock });

    render(<CardDetailPage />);

    expect(screen.getByText('Visa Platinum')).toBeInTheDocument();
    expect(screen.getByTestId('card-payment-summary')).toBeInTheDocument();
    expect(screen.getByTestId('payment-history-entry')).toBeInTheDocument();
  });

  it('shows a not-found message when no card matches the route id', async () => {
    useAccountsMock.mockReturnValue({ cards: [], incomeSources: [], loading: false, error: null });
    useCardPaymentsMock.mockReturnValue({ payments: [], loading: false, error: null, recordPayment: recordPaymentMock });

    render(<CardDetailPage />);

    expect(screen.getByTestId('card-not-found')).toBeInTheDocument();
  });

  it('opens the Record Payment form and submits through the hook', async () => {
    useAccountsMock.mockReturnValue({ cards: [card], incomeSources: [], loading: false, error: null });
    useCardPaymentsMock.mockReturnValue({ payments: [], loading: false, error: null, recordPayment: recordPaymentMock });
    const user = userEvent.setup();

    render(<CardDetailPage />);
    await user.click(screen.getByRole('button', { name: /record payment/i }));
    await user.type(screen.getByLabelText(/^amount$/i), '150');
    await user.click(screen.getByRole('button', { name: /^record payment$/i }));

    await waitFor(() => expect(recordPaymentMock).toHaveBeenCalledWith(expect.objectContaining({ amount: 150 })));
  });
});
