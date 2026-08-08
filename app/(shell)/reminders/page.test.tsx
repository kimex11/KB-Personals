import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

const reminders = [
  { id: 'reminder-1', title: 'Call insurance provider', category: 'Finance', dueDate: '2026-08-06', priority: 'high' as const, completed: false },
  { id: 'reminder-2', title: 'Renew car insurance', category: 'Finance', dueDate: '2026-08-03', priority: 'high' as const, completed: true },
];

const createReminderMock = vi.fn().mockResolvedValue(undefined);
const updateReminderMock = vi.fn().mockResolvedValue(undefined);
const deleteReminderMock = vi.fn().mockResolvedValue(undefined);
const toggleCompleteMock = vi.fn().mockResolvedValue(undefined);
const snoozeMock = vi.fn().mockResolvedValue(undefined);

const { useRemindersMock } = vi.hoisted(() => ({ useRemindersMock: vi.fn() }));

vi.mock('@/lib/use-reminders', () => ({
  useReminders: useRemindersMock,
}));

import { useSearchParams } from 'next/navigation';
import RemindersPage from './page';

beforeEach(() => {
  useRemindersMock.mockReturnValue({
    reminders,
    loading: false,
    error: null,
    refresh: vi.fn(),
    createReminder: createReminderMock,
    updateReminder: updateReminderMock,
    deleteReminder: deleteReminderMock,
    toggleComplete: toggleCompleteMock,
    snooze: snoozeMock,
  });
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as ReturnType<typeof useSearchParams>);
});

describe('RemindersPage', () => {
  it('shows a loading state instead of the list while fetching', () => {
    useRemindersMock.mockReturnValue({
      reminders: [],
      loading: true,
      error: null,
      refresh: vi.fn(),
      createReminder: createReminderMock,
      updateReminder: updateReminderMock,
      deleteReminder: deleteReminderMock,
      toggleComplete: toggleCompleteMock,
      snooze: snoozeMock,
    });
    render(<RemindersPage />);
    expect(screen.getByTestId('reminders-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('reminders-list-view')).not.toBeInTheDocument();
  });

  it('renders the reminders list view', () => {
    render(<RemindersPage />);
    expect(screen.getByTestId('reminders-list-view')).toBeInTheDocument();
    expect(screen.getAllByTestId('reminder-row').length).toBeGreaterThan(0);
  });

  it('calls toggleComplete when a reminder toggle is clicked', () => {
    render(<RemindersPage />);
    const firstIncomplete = screen
      .getAllByTestId('reminder-complete-toggle')
      .find((el) => el.getAttribute('aria-pressed') === 'false')!;
    fireEvent.click(firstIncomplete);
    expect(toggleCompleteMock).toHaveBeenCalledWith('reminder-1');
  });

  it('renders a snooze button on incomplete reminders and calls snooze', () => {
    render(<RemindersPage />);
    const snoozeButtons = screen.getAllByTestId('reminder-snooze-button');
    expect(snoozeButtons.length).toBeGreaterThan(0);
    fireEvent.click(snoozeButtons[0]);
    expect(snoozeMock).toHaveBeenCalledWith('reminder-1');
  });

  it('renders an Add Reminder button that opens the form and creates a reminder on submit', async () => {
    const user = userEvent.setup();
    render(<RemindersPage />);
    await user.click(screen.getByRole('button', { name: /add reminder/i }));
    expect(screen.getByRole('heading', { name: /add reminder/i })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/title/i), 'Water plants');
    await user.type(screen.getByLabelText(/category/i), 'Home');
    await user.type(screen.getByLabelText(/due date/i), '2026-09-01');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(createReminderMock).toHaveBeenCalledWith({ title: 'Water plants', category: 'Home', dueDate: '2026-09-01', priority: 'medium' });
  });

  it('opens the edit form pre-filled when a reminder row Edit is chosen from its actions menu', async () => {
    const user = userEvent.setup();
    render(<RemindersPage />);
    await user.click(screen.getByRole('button', { name: /actions for call insurance provider/i }));
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }));
    expect(screen.getByRole('heading', { name: /edit reminder/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/title/i)).toHaveValue('Call insurance provider');
  });

  it('deletes a reminder after confirming', async () => {
    const user = userEvent.setup();
    render(<RemindersPage />);
    await user.click(screen.getByRole('button', { name: /actions for call insurance provider/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(deleteReminderMock).toHaveBeenCalledWith('reminder-1');
  });

  it('opens the edit form for the reminder named in the ?open= query param', async () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams('open=reminder-2') as ReturnType<typeof useSearchParams>);
    render(<RemindersPage />);
    await waitFor(() => expect(screen.getByRole('heading', { name: /edit reminder/i })).toBeInTheDocument());
    expect(screen.getByLabelText(/title/i)).toHaveValue('Renew car insurance');
  });
});
