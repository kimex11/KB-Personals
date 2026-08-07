import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from './page';
import type { CalendarEvent } from '@/lib/types';

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
