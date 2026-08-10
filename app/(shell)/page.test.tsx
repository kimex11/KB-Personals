import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import HomePage from './page';
import type { CalendarEvent } from '@/lib/types';
import { listSentStateKeys } from '@/lib/notification-log-repository';

vi.mock('@/lib/push-subscription', () => ({
  subscribeToPush: vi.fn().mockResolvedValue(true),
  isPushSupported: vi.fn().mockReturnValue(true),
}));
vi.mock('@/lib/notification-preferences-repository', () => ({
  getPreferences: vi.fn().mockResolvedValue({
    quietHoursStart: null,
    quietHoursEnd: null,
    soundEnabled: true,
    enabledPriorities: ['critical', 'urgent', 'reminder'],
  }),
  upsertPreferences: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/notification-log-repository', () => ({
  listSentStateKeys: vi.fn().mockResolvedValue(new Set()),
}));

const mockEvents: CalendarEvent[] = [
  { id: 'overdue-1', type: 'bill', title: 'Overdue Rent', date: '2026-08-01', amount: 1450 },
  { id: 'due-1', type: 'bill', title: 'Internet Bill', date: '2026-08-15', amount: 59.99 },
  { id: 'reminder-1', type: 'reminder', title: 'Call insurance provider', date: '2026-08-16' },
];

vi.mock('@/lib/use-calendar-events', () => ({
  useCalendarEvents: () => ({ events: mockEvents, getEventsForDate: () => [] }),
}));

vi.mock('@/lib/use-budget', () => ({
  useBudget: () => ({
    categories: [],
    totals: { budgeted: 3000, spent: 1800, remaining: 1200 },
    loading: false,
    error: null,
  }),
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

const { useBillsMock } = vi.hoisted(() => ({ useBillsMock: vi.fn() }));
vi.mock('@/lib/use-bills', () => ({ useBills: useBillsMock }));

const togglePaidMock = vi.fn().mockResolvedValue(undefined);
const defaultUseBillsResult = {
  bills: [] as unknown[],
  loading: false,
  error: null,
  refresh: vi.fn(),
  createBill: vi.fn(),
  updateBill: vi.fn(),
  deleteBill: vi.fn(),
  togglePaid: togglePaidMock,
};
useBillsMock.mockReturnValue(defaultUseBillsResult);

describe('HomePage', () => {
  it('renders the alerts banner when there are overdue bills', () => {
    render(<HomePage />);
    expect(screen.getByTestId('alerts-banner')).toBeInTheDocument();
  });

  it('renders the weekly bills panel, spending snapshot, reminders, and quick actions', () => {
    render(<HomePage />);
    expect(screen.getByTestId('weekly-bills-panel')).toBeInTheDocument();
    expect(screen.getByTestId('spending-snapshot')).toBeInTheDocument();
    expect(screen.getByTestId('reminders-panel')).toBeInTheDocument();
    expect(screen.getByTestId('quick-actions-row')).toBeInTheDocument();
  });

  it('does not render Recent Transactions or Goal Progress (no backing feature)', () => {
    render(<HomePage />);
    expect(screen.queryByTestId('recent-transactions-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('goal-progress-panel')).not.toBeInTheDocument();
  });

  it('renders the calendar card after the alerts banner', () => {
    render(<HomePage />);
    const alertsBanner = screen.getByTestId('alerts-banner');
    const calendarCard = screen.getByTestId('dashboard-calendar-card');
    expect(alertsBanner.compareDocumentPosition(calendarCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders notification settings', () => {
    render(<HomePage />);
    expect(screen.getByTestId('notification-settings')).toBeInTheDocument();
  });

  it('shows an error message when bills fail to load', () => {
    useBillsMock.mockReturnValueOnce({ ...defaultUseBillsResult, error: 'Could not load bills.' });
    render(<HomePage />);
    expect(screen.getByText('Could not load bills.')).toBeInTheDocument();
  });

  it('does not re-query notification_log on a re-render when bills/reminders/events are unchanged', async () => {
    vi.mocked(listSentStateKeys).mockClear();
    const { rerender } = render(<HomePage />);
    await waitFor(() => expect(vi.mocked(listSentStateKeys)).toHaveBeenCalledTimes(1));

    vi.mocked(listSentStateKeys).mockClear();
    rerender(<HomePage />);

    // Give any (incorrectly) re-triggered effect a tick to fire before asserting.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(listSentStateKeys).not.toHaveBeenCalled();
  });

  it('excludes an already-paid bill from the overdue alerts banner', () => {
    useBillsMock.mockReturnValueOnce({
      ...defaultUseBillsResult,
      bills: [
        { id: 'overdue-1', title: 'Overdue Rent', category: 'Housing', categoryId: 'cat-1', amount: 1450, dueDate: '2026-08-01', recurrence: null, paid: true },
      ],
    });
    render(<HomePage />);
    expect(screen.queryByText('Overdue Rent')).not.toBeInTheDocument();
  });
});
