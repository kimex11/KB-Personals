import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const card = { id: 'card-1', cardName: 'Visa Platinum', last4: '4821', statementBalance: 842.5, minimumPayment: 45, dueDate: '2026-08-16' };
const income = { id: 'income-1', name: 'Salary', amount: 3200, frequency: 'biweekly' as const, nextDate: '2026-08-20' };

const createCardMock = vi.fn().mockResolvedValue(undefined);
const updateCardMock = vi.fn().mockResolvedValue(undefined);
const deleteCardMock = vi.fn().mockResolvedValue(undefined);
const createIncomeMock = vi.fn().mockResolvedValue(undefined);
const updateIncomeMock = vi.fn().mockResolvedValue(undefined);
const deleteIncomeMock = vi.fn().mockResolvedValue(undefined);

const { useAccountsMock } = vi.hoisted(() => ({ useAccountsMock: vi.fn() }));

vi.mock('@/lib/use-accounts', () => ({
  useAccounts: useAccountsMock,
}));

import AccountsPage from './page';

beforeEach(() => {
  useAccountsMock.mockReturnValue({
    cards: [card],
    incomeSources: [income],
    loading: false,
    error: null,
    refresh: vi.fn(),
    createCard: createCardMock,
    updateCard: updateCardMock,
    deleteCard: deleteCardMock,
    createIncome: createIncomeMock,
    updateIncome: updateIncomeMock,
    deleteIncome: deleteIncomeMock,
  });
});

describe('AccountsPage', () => {
  it('shows a loading state instead of the summary while fetching', () => {
    useAccountsMock.mockReturnValue({
      cards: [],
      incomeSources: [],
      loading: true,
      error: null,
      refresh: vi.fn(),
      createCard: createCardMock,
      updateCard: updateCardMock,
      deleteCard: deleteCardMock,
      createIncome: createIncomeMock,
      updateIncome: updateIncomeMock,
      deleteIncome: deleteIncomeMock,
    });
    render(<AccountsPage />);
    expect(screen.getByTestId('accounts-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('accounts-summary')).not.toBeInTheDocument();
  });

  it('renders the accounts summary', () => {
    render(<AccountsPage />);
    expect(screen.getByTestId('accounts-summary')).toBeInTheDocument();
  });

  it('renders one row per credit card and one row per income source', () => {
    render(<AccountsPage />);
    expect(screen.getAllByTestId('card-due-row')).toHaveLength(1);
    expect(screen.getAllByTestId('income-row')).toHaveLength(1);
  });

  it('groups content under Credit Card Dues and Income headings', () => {
    render(<AccountsPage />);
    expect(screen.getByRole('heading', { name: 'Credit Card Dues' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Income' })).toBeInTheDocument();
  });

  it('renders Add Card and Add Income buttons', () => {
    render(<AccountsPage />);
    expect(screen.getByRole('button', { name: /add card/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add income/i })).toBeInTheDocument();
  });

  it('opens the card form when Add Card is clicked and creates a card on submit', async () => {
    const user = userEvent.setup();
    render(<AccountsPage />);
    await user.click(screen.getByRole('button', { name: /add card/i }));
    expect(screen.getByRole('heading', { name: /add credit card/i })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/card name/i), 'Amex Gold');
    await user.type(screen.getByLabelText(/last 4 digits/i), '1234');
    await user.type(screen.getByLabelText(/statement balance/i), '100');
    await user.type(screen.getByLabelText(/minimum payment/i), '10');
    await user.type(screen.getByLabelText(/due date/i), '2026-09-01');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(createCardMock).toHaveBeenCalledWith({
      cardName: 'Amex Gold',
      last4: '1234',
      statementBalance: 100,
      minimumPayment: 10,
      dueDate: '2026-09-01',
    });
  });

  it('opens the edit form pre-filled when a card row Edit is chosen from its actions menu', async () => {
    const user = userEvent.setup();
    render(<AccountsPage />);
    await user.click(screen.getByRole('button', { name: /actions for visa platinum/i }));
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }));
    expect(screen.getByRole('heading', { name: /edit credit card/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/card name/i)).toHaveValue('Visa Platinum');
  });

  it('deletes a card after confirming', async () => {
    const user = userEvent.setup();
    render(<AccountsPage />);
    await user.click(screen.getByRole('button', { name: /actions for visa platinum/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    expect(screen.getByRole('heading', { name: /delete visa platinum/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(deleteCardMock).toHaveBeenCalledWith('card-1');
  });

  it('opens the income form when Add Income is clicked and creates an income source on submit', async () => {
    const user = userEvent.setup();
    render(<AccountsPage />);
    await user.click(screen.getByRole('button', { name: /add income/i }));
    expect(screen.getByRole('heading', { name: /add income source/i })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^name$/i), 'Bonus');
    await user.type(screen.getByLabelText(/amount/i), '500');
    await user.type(screen.getByLabelText(/next date/i), '2026-09-01');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(createIncomeMock).toHaveBeenCalledWith({ name: 'Bonus', amount: 500, frequency: 'monthly', nextDate: '2026-09-01' });
  });

  it('deletes an income source after confirming', async () => {
    const user = userEvent.setup();
    render(<AccountsPage />);
    await user.click(screen.getByRole('button', { name: /actions for salary/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(deleteIncomeMock).toHaveBeenCalledWith('income-1');
  });
});
