import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock('@/lib/use-calendar-events', () => ({
  useCalendarEvents: () => ({ events: [], getEventsForDate: () => [] }),
}));

vi.mock('@/lib/use-reminders', () => ({
  useReminders: () => ({
    reminders: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
    createReminder: vi.fn(),
    updateReminder: vi.fn(),
    deleteReminder: vi.fn(),
    toggleComplete: vi.fn(),
    snooze: vi.fn(),
  }),
}));

const bills = [
  { id: 'bill-1', title: 'Rent', category: 'Housing', categoryId: 'cat-1', amount: 1450, dueDate: '2026-08-01', recurrence: 'monthly' as const, paid: true },
  { id: 'bill-2', title: 'Electricity', category: 'Utilities', categoryId: 'cat-2', amount: 85, dueDate: '2026-08-20', recurrence: 'monthly' as const, paid: false },
];

const categories = [
  { id: 'cat-1', name: 'Housing', icon: 'building-2' as const, colorSlot: 1, sortOrder: 0, archived: false, createdAt: '2026-08-15T10:00:00.000Z' },
  { id: 'cat-2', name: 'Utilities', icon: 'zap' as const, colorSlot: 5, sortOrder: 1, archived: false, createdAt: '2026-08-15T10:00:00.000Z' },
];

const createBillMock = vi.fn().mockResolvedValue(undefined);
const updateBillMock = vi.fn().mockResolvedValue(undefined);
const deleteBillMock = vi.fn().mockResolvedValue(undefined);
const togglePaidMock = vi.fn().mockResolvedValue(undefined);

const { useBillsMock } = vi.hoisted(() => ({ useBillsMock: vi.fn() }));

vi.mock('@/lib/use-bills', () => ({
  useBills: useBillsMock,
}));

vi.mock('@/lib/use-categories', () => ({
  useCategories: () => ({
    categories,
    activeCategories: categories,
    archivedCategories: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    unarchive: vi.fn(),
    remove: vi.fn(),
    merge: vi.fn(),
    reorder: vi.fn(),
  }),
}));

import { useSearchParams } from 'next/navigation';
import BillsPage from './page';

beforeEach(() => {
  useBillsMock.mockReturnValue({
    bills,
    loading: false,
    error: null,
    refresh: vi.fn(),
    createBill: createBillMock,
    updateBill: updateBillMock,
    deleteBill: deleteBillMock,
    togglePaid: togglePaidMock,
  });
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as ReturnType<typeof useSearchParams>);
});

describe('BillsPage', () => {
  it('shows a loading state instead of the list while fetching', () => {
    useBillsMock.mockReturnValue({
      bills: [],
      loading: true,
      error: null,
      refresh: vi.fn(),
      createBill: createBillMock,
      updateBill: updateBillMock,
      deleteBill: deleteBillMock,
      togglePaid: togglePaidMock,
    });
    render(<BillsPage />);
    expect(screen.getByTestId('bills-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('bills-list-view')).not.toBeInTheDocument();
  });

  it('shows the list view by default', () => {
    render(<BillsPage />);
    expect(screen.getByTestId('bills-list-view')).toBeInTheDocument();
  });

  it('switches to the calendar view when the Calendar toggle is clicked', () => {
    render(<BillsPage />);
    fireEvent.click(screen.getByTestId('bills-view-calendar'));
    expect(screen.getByTestId('month-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('bills-list-view')).not.toBeInTheDocument();
  });

  it('switches back to the list view when the List toggle is clicked', () => {
    render(<BillsPage />);
    fireEvent.click(screen.getByTestId('bills-view-calendar'));
    fireEvent.click(screen.getByTestId('bills-view-list'));
    expect(screen.getByTestId('bills-list-view')).toBeInTheDocument();
  });

  it('calls togglePaid when a bill toggle is clicked', () => {
    render(<BillsPage />);
    const firstUnpaid = screen
      .getAllByTestId('bill-paid-toggle')
      .find((el) => el.getAttribute('aria-pressed') === 'false')!;
    fireEvent.click(firstUnpaid);
    expect(togglePaidMock).toHaveBeenCalledWith('bill-2');
  });

  it('renders an Add Bill button that opens the form and creates a bill on submit', async () => {
    const user = userEvent.setup();
    render(<BillsPage />);
    await user.click(screen.getByRole('button', { name: /add bill/i }));
    expect(screen.getByRole('heading', { name: /add bill/i })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/title/i), 'Water Bill');
    await user.type(screen.getByLabelText(/amount/i), '30');
    await user.type(screen.getByLabelText(/due date/i), '2026-09-01');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(createBillMock).toHaveBeenCalledWith({ title: 'Water Bill', categoryId: 'cat-1', amount: 30, dueDate: '2026-09-01', recurrence: null });
  });

  it('opens the edit form pre-filled when a bill row Edit is chosen from its actions menu', async () => {
    const user = userEvent.setup();
    render(<BillsPage />);
    await user.click(screen.getByRole('button', { name: /actions for rent/i }));
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }));
    expect(screen.getByRole('heading', { name: /edit bill/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/title/i)).toHaveValue('Rent');
  });

  it('deletes a bill after confirming', async () => {
    const user = userEvent.setup();
    render(<BillsPage />);
    await user.click(screen.getByRole('button', { name: /actions for rent/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(deleteBillMock).toHaveBeenCalledWith('bill-1');
  });

  it('opens the edit form for the bill named in the ?open= query param', async () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams('open=bill-2') as ReturnType<typeof useSearchParams>);
    render(<BillsPage />);
    await waitFor(() => expect(screen.getByRole('heading', { name: /edit bill/i })).toBeInTheDocument());
    expect(screen.getByLabelText(/title/i)).toHaveValue('Electricity');
  });
});
