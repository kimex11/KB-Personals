import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaymentPlanDetailPage from './page';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'plan-1' }),
}));

const plan = { id: 'plan-1', name: 'iPhone 15', categoryId: 'cat-1', category: 'Electronics', categoryColorSlot: 4, totalAmount: 36000, installmentCount: 12, monthlyAmount: 3000, startDate: '2026-01-01' };

const { usePaymentPlansMock, usePlanPaymentsMock, recordPaymentMock } = vi.hoisted(() => ({
  usePaymentPlansMock: vi.fn(),
  usePlanPaymentsMock: vi.fn(),
  recordPaymentMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/use-payment-plans', () => ({ usePaymentPlans: usePaymentPlansMock }));
vi.mock('@/lib/use-plan-payments', () => ({ usePlanPayments: usePlanPaymentsMock }));

const payment = { id: 'pp-1', planId: 'plan-1', installmentNumber: 1, amount: 3000, balanceBefore: 36000, balanceAfter: 33000, paidAt: '2026-01-01T10:00:00.000Z' };

describe('PaymentPlanDetailPage', () => {
  it('shows the plan name, progress summary, and payment history', async () => {
    usePaymentPlansMock.mockReturnValue({ plans: [plan], loading: false, error: null, create: vi.fn(), remove: vi.fn() });
    usePlanPaymentsMock.mockReturnValue({ payments: [payment], loading: false, error: null, recordPayment: recordPaymentMock });

    render(<PaymentPlanDetailPage />);

    expect(screen.getByText('iPhone 15')).toBeInTheDocument();
    expect(screen.getByTestId('plan-progress-summary')).toBeInTheDocument();
    expect(screen.getByTestId('plan-payment-history-entry')).toBeInTheDocument();
  });

  it('shows a not-found message when no plan matches the route id', () => {
    usePaymentPlansMock.mockReturnValue({ plans: [], loading: false, error: null, create: vi.fn(), remove: vi.fn() });
    usePlanPaymentsMock.mockReturnValue({ payments: [], loading: false, error: null, recordPayment: recordPaymentMock });

    render(<PaymentPlanDetailPage />);

    expect(screen.getByTestId('payment-plan-not-found')).toBeInTheDocument();
  });

  it('opens the Record Payment form defaulting to the monthly amount and submits through the hook', async () => {
    usePaymentPlansMock.mockReturnValue({ plans: [plan], loading: false, error: null, create: vi.fn(), remove: vi.fn() });
    usePlanPaymentsMock.mockReturnValue({ payments: [], loading: false, error: null, recordPayment: recordPaymentMock });
    const user = userEvent.setup();

    render(<PaymentPlanDetailPage />);
    await user.click(screen.getByRole('button', { name: /record payment/i }));
    expect(screen.getByLabelText(/^amount$/i)).toHaveValue('3,000');
    await user.click(screen.getByRole('button', { name: /^record payment$/i }));

    await waitFor(() => expect(recordPaymentMock).toHaveBeenCalledWith(expect.objectContaining({ amount: 3000 })));
  });
});
