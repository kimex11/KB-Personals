import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { useExpensesMock, useCategoriesMock, useBillsMock, listAllCreditCardPaymentsMock, createMock, updateMock, removeMock } = vi.hoisted(() => ({
  useExpensesMock: vi.fn(),
  useCategoriesMock: vi.fn(),
  useBillsMock: vi.fn(),
  listAllCreditCardPaymentsMock: vi.fn(),
  createMock: vi.fn().mockResolvedValue(undefined),
  updateMock: vi.fn().mockResolvedValue(undefined),
  removeMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/use-expenses', () => ({ useExpenses: useExpensesMock }));
vi.mock('@/lib/use-categories', () => ({ useCategories: useCategoriesMock }));
vi.mock('@/lib/use-bills', () => ({ useBills: useBillsMock }));
vi.mock('@/lib/credit-card-payments-repository', () => ({ listAllCreditCardPayments: listAllCreditCardPaymentsMock }));

import BudgetPage from './page';

const categories = [
  { id: 'cat-1', name: 'Groceries', icon: 'shopping-cart', colorSlot: 2, sortOrder: 0, archived: false, createdAt: '2026-08-15T10:00:00.000Z' },
];

const expenses = [
  { id: 'exp-1', categoryId: 'cat-1', category: 'Groceries', categoryColorSlot: 2, amount: 850, date: '2026-08-12', description: 'Weekly run', paymentMethod: 'Cash' },
];

const bills = [
  { id: 'bill-1', title: 'Rent', category: 'Housing', categoryId: 'cat-2', amount: 1450, dueDate: '2026-08-01', recurrence: null, paid: true, seriesId: null, cycleNumber: null, skipped: false },
];

function mockDefaults() {
  useExpensesMock.mockReturnValue({ expenses, loading: false, error: null, refresh: vi.fn(), create: createMock, update: updateMock, remove: removeMock });
  useCategoriesMock.mockReturnValue({ categories, activeCategories: categories, archivedCategories: [], loading: false, error: null, refresh: vi.fn(), create: vi.fn(), update: vi.fn(), archive: vi.fn(), unarchive: vi.fn(), remove: vi.fn(), merge: vi.fn(), reorder: vi.fn() });
  useBillsMock.mockReturnValue({ bills, loading: false, error: null, refresh: vi.fn(), createBill: vi.fn(), createRecurringBill: vi.fn(), updateBill: vi.fn(), deleteBill: vi.fn(), togglePaid: vi.fn(), skipCycle: vi.fn(), pendingSyncIds: new Set() });
  listAllCreditCardPaymentsMock.mockResolvedValue([
    { id: 'pay-1', cardId: 'card-1', amount: 300, balanceBefore: 842.5, balanceAfter: 542.5, paidAt: '2026-08-10T10:00:00.000Z', method: null, notes: null },
  ]);
}

describe('BudgetPage (Expenses tracker)', () => {
  it('shows the expenses summary, payments/repayments summary, and the expense list', async () => {
    mockDefaults();
    render(<BudgetPage />);

    expect(screen.getByTestId('expenses-summary')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('payments-repayments-summary')).toHaveTextContent('1,450.00'));
    expect(screen.getByTestId('expense-row')).toBeInTheDocument();
    expect(screen.getByTestId('expenses-donut-chart')).toBeInTheDocument();
  });

  it('links to the Manage Categories screen', () => {
    mockDefaults();
    render(<BudgetPage />);
    expect(screen.getByRole('link', { name: /manage categories/i })).toHaveAttribute('href', '/budget/categories');
  });

  it('shows a loading state instead of the summaries while fetching', () => {
    useExpensesMock.mockReturnValue({ expenses: [], loading: true, error: null, refresh: vi.fn(), create: createMock, update: updateMock, remove: removeMock });
    useCategoriesMock.mockReturnValue({ categories: [], activeCategories: [], archivedCategories: [], loading: false, error: null, refresh: vi.fn(), create: vi.fn(), update: vi.fn(), archive: vi.fn(), unarchive: vi.fn(), remove: vi.fn(), merge: vi.fn(), reorder: vi.fn() });
    useBillsMock.mockReturnValue({ bills: [], loading: false, error: null, refresh: vi.fn(), createBill: vi.fn(), createRecurringBill: vi.fn(), updateBill: vi.fn(), deleteBill: vi.fn(), togglePaid: vi.fn(), skipCycle: vi.fn(), pendingSyncIds: new Set() });
    listAllCreditCardPaymentsMock.mockResolvedValue([]);
    render(<BudgetPage />);
    expect(screen.getByTestId('budget-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('expenses-summary')).not.toBeInTheDocument();
  });

  it('shows an error message when loading expenses fails', () => {
    useExpensesMock.mockReturnValue({ expenses: [], loading: false, error: 'Could not load expenses.', refresh: vi.fn(), create: createMock, update: updateMock, remove: removeMock });
    useCategoriesMock.mockReturnValue({ categories: [], activeCategories: [], archivedCategories: [], loading: false, error: null, refresh: vi.fn(), create: vi.fn(), update: vi.fn(), archive: vi.fn(), unarchive: vi.fn(), remove: vi.fn(), merge: vi.fn(), reorder: vi.fn() });
    useBillsMock.mockReturnValue({ bills: [], loading: false, error: null, refresh: vi.fn(), createBill: vi.fn(), createRecurringBill: vi.fn(), updateBill: vi.fn(), deleteBill: vi.fn(), togglePaid: vi.fn(), skipCycle: vi.fn(), pendingSyncIds: new Set() });
    listAllCreditCardPaymentsMock.mockResolvedValue([]);
    render(<BudgetPage />);
    expect(screen.getByText('Could not load expenses.')).toBeInTheDocument();
  });

  it('opens the Add Expense form and submits through the hook', async () => {
    mockDefaults();
    const user = userEvent.setup();
    render(<BudgetPage />);

    await user.click(screen.getByRole('button', { name: /add expense/i }));
    await user.type(screen.getByLabelText(/amount/i), '500');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ amount: 500 })));
  });
});
