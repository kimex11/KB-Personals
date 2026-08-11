import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReminderTile } from './ReminderTile';
import type { Reminder } from '@/lib/reminders-types';

const referenceDate = new Date(2026, 7, 15);

const reminder: Reminder = {
  id: '1',
  title: 'Call insurance provider',
  category: 'Finance',
  dueDate: '2026-08-15',
  priority: 'high',
  completed: false,
  seriesId: null,
  cycleNumber: null,
  skipped: false,
};

describe('ReminderTile', () => {
  it('shows title, category, and priority badge', () => {
    render(<ReminderTile reminder={reminder} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    const tile = screen.getByTestId('reminder-row');
    expect(tile).toHaveTextContent('Call insurance provider');
    expect(tile).toHaveTextContent('Finance');
    expect(tile).toHaveTextContent('High');
  });

  it('applies strikethrough styling when completed', () => {
    const completed: Reminder = { ...reminder, completed: true };
    render(<ReminderTile reminder={completed} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('reminder-title').className).toContain('line-through');
  });

  it('calls onToggleComplete with the reminder id when the toggle is clicked', () => {
    const onToggleComplete = vi.fn();
    render(<ReminderTile reminder={reminder} onToggleComplete={onToggleComplete} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    fireEvent.click(screen.getByTestId('reminder-complete-toggle'));
    expect(onToggleComplete).toHaveBeenCalledWith('1');
  });

  it('calls onSnooze with the reminder id when Snooze is clicked', () => {
    const onSnooze = vi.fn();
    render(<ReminderTile reminder={reminder} onToggleComplete={vi.fn()} onSnooze={onSnooze} referenceDate={referenceDate} />);
    fireEvent.click(screen.getByTestId('reminder-snooze-button'));
    expect(onSnooze).toHaveBeenCalledWith('1');
  });

  it('hides the Snooze button once the reminder is completed', () => {
    const completed: Reminder = { ...reminder, completed: true };
    render(<ReminderTile reminder={completed} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.queryByTestId('reminder-snooze-button')).not.toBeInTheDocument();
  });

  it('tints the card background to match priority: high', () => {
    render(<ReminderTile reminder={reminder} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('reminder-row')).toHaveClass('bg-status-critical/10');
  });

  it('uses a neutral gray background for priority: low', () => {
    const low: Reminder = { ...reminder, priority: 'low' };
    render(<ReminderTile reminder={low} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('reminder-row')).toHaveClass('bg-neutral-100');
  });

  it('tints the card background green once completed, regardless of priority', () => {
    const completed: Reminder = { ...reminder, completed: true };
    render(<ReminderTile reminder={completed} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('reminder-row')).toHaveClass('bg-status-success/10');
  });

  it('calls onEdit/onDelete via the actions menu', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(
      <ReminderTile reminder={reminder} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} onEdit={onEdit} onDelete={onDelete} />
    );

    await user.click(screen.getByRole('button', { name: /actions for call insurance provider/i }));
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(reminder);

    await user.click(screen.getByRole('button', { name: /actions for call insurance provider/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(reminder);
  });
});
