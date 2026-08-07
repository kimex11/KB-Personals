import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReminderRow } from './ReminderRow';
import type { Reminder } from '@/lib/reminders-types';

const referenceDate = new Date(2026, 7, 15);

const reminder: Reminder = {
  id: '1',
  title: 'Call insurance provider',
  category: 'Finance',
  dueDate: '2026-08-15',
  priority: 'high',
  completed: false,
};

describe('ReminderRow', () => {
  it('shows title, category, and priority badge', () => {
    render(<ReminderRow reminder={reminder} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    const row = screen.getByTestId('reminder-row');
    expect(row).toHaveTextContent('Call insurance provider');
    expect(row).toHaveTextContent('Finance');
    expect(row).toHaveTextContent('High');
  });

  it('applies strikethrough styling when completed', () => {
    const completed: Reminder = { ...reminder, completed: true };
    render(<ReminderRow reminder={completed} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('reminder-title').className).toContain('line-through');
  });

  it('calls onToggleComplete with the reminder id when the toggle is clicked', () => {
    const onToggleComplete = vi.fn();
    render(<ReminderRow reminder={reminder} onToggleComplete={onToggleComplete} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    fireEvent.click(screen.getByTestId('reminder-complete-toggle'));
    expect(onToggleComplete).toHaveBeenCalledWith('1');
  });

  it('calls onSnooze with the reminder id when Snooze is clicked', () => {
    const onSnooze = vi.fn();
    render(<ReminderRow reminder={reminder} onToggleComplete={vi.fn()} onSnooze={onSnooze} referenceDate={referenceDate} />);
    fireEvent.click(screen.getByTestId('reminder-snooze-button'));
    expect(onSnooze).toHaveBeenCalledWith('1');
  });

  it('hides the Snooze button once the reminder is completed', () => {
    const completed: Reminder = { ...reminder, completed: true };
    render(<ReminderRow reminder={completed} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.queryByTestId('reminder-snooze-button')).not.toBeInTheDocument();
  });

  it('calls onEdit/onDelete when the action buttons are clicked', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <ReminderRow reminder={reminder} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} onEdit={onEdit} onDelete={onDelete} />
    );

    fireEvent.click(screen.getByRole('button', { name: /edit call insurance provider/i }));
    expect(onEdit).toHaveBeenCalledWith(reminder);

    fireEvent.click(screen.getByRole('button', { name: /delete call insurance provider/i }));
    expect(onDelete).toHaveBeenCalledWith(reminder);
  });
});
