import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { usePaymentPlansMock, useCategoriesMock, listAllPlanPaymentsMock, createMock } = vi.hoisted(() => ({
  usePaymentPlansMock: vi.fn(),
  useCategoriesMock: vi.fn(),
  listAllPlanPaymentsMock: vi.fn(),
  createMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/use-payment-plans', () => ({ usePaymentPlans: usePaymentPlansMock }));
vi.mock('@/lib/use-categories', () => ({ useCategories: useCategoriesMock }));
vi.mock('@/lib/payment-plan-payments-repository', () => ({ listAllPlanPayments: listAllPlanPaymentsMock }));

import PaymentPlansPage from './page';

const categories = [
  { id: 'cat-1', name: 'Electronics', icon: 'smartphone', colorSlot: 4, sortOrder: 0, archived: false, createdAt: '2026-01-01T10:00:00.000Z' },
];

const plans = [
  { id: 'plan-1', name: 'iPhone 15', categoryId: 'cat-1', category: 'Electronics', categoryColorSlot: 4, totalAmount: 36000, installmentCount: 12, monthlyAmount: 3000, startDate: '2026-01-01' },
];

function mockDefaults() {
  usePaymentPlansMock.mockReturnValue({ plans, loading: false, error: null, refresh: vi.fn(), create: createMock, remove: vi.fn() });
  useCategoriesMock.mockReturnValue({ categories, activeCategories: categories, archivedCategories: [], loading: false, error: null, refresh: vi.fn(), create: vi.fn(), update: vi.fn(), archive: vi.fn(), unarchive: vi.fn(), remove: vi.fn(), merge: vi.fn(), reorder: vi.fn() });
  listAllPlanPaymentsMock.mockResolvedValue([
    { id: 'pp-1', planId: 'plan-1', installmentNumber: 1, amount: 3000, balanceBefore: 36000, balanceAfter: 33000, paidAt: '2026-01-01T10:00:00.000Z' },
  ]);
}

describe('PaymentPlansPage', () => {
  it('shows the list of payment plans', async () => {
    mockDefaults();
    render(<PaymentPlansPage />);
    await waitFor(() => expect(screen.getAllByTestId('payment-plan-row')).toHaveLength(1));
  });

  it('shows a loading state while fetching', () => {
    usePaymentPlansMock.mockReturnValue({ plans: [], loading: true, error: null, refresh: vi.fn(), create: createMock, remove: vi.fn() });
    useCategoriesMock.mockReturnValue({ categories: [], activeCategories: [], archivedCategories: [], loading: false, error: null, refresh: vi.fn(), create: vi.fn(), update: vi.fn(), archive: vi.fn(), unarchive: vi.fn(), remove: vi.fn(), merge: vi.fn(), reorder: vi.fn() });
    listAllPlanPaymentsMock.mockResolvedValue([]);
    render(<PaymentPlansPage />);
    expect(screen.getByTestId('payment-plans-loading')).toBeInTheDocument();
  });

  it('opens the Add Plan form and submits through the hook', async () => {
    mockDefaults();
    const user = userEvent.setup();
    render(<PaymentPlansPage />);

    await user.click(screen.getByRole('button', { name: /add plan/i }));
    await user.type(screen.getByLabelText(/plan name/i), 'iPhone 15');
    await user.type(screen.getByLabelText(/total amount/i), '36000');
    await user.type(screen.getByLabelText(/number of installments/i), '12');
    await user.type(screen.getByLabelText(/monthly amount/i), '3000');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'iPhone 15', totalAmount: 36000 })));
  });
});
