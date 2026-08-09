import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReminderForm } from './ReminderForm';

const existingReminder = { id: 'reminder-1', title: 'Renew passport', category: 'Personal', dueDate: '2026-08-16', priority: 'high' as const, completed: false };

describe('ReminderForm', () => {
  it('renders empty fields for a new reminder, priority defaulting to medium', () => {
    render(<ReminderForm open onOpenChange={() => {}} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/title/i)).toHaveValue('');
    expect(screen.getByLabelText(/category/i)).toHaveValue('');
    expect(screen.getByLabelText(/priority/i)).toHaveValue('medium');
    expect(screen.getByRole('heading', { name: /add reminder/i })).toBeInTheDocument();
  });

  it('pre-fills fields when editing an existing reminder', () => {
    render(<ReminderForm open onOpenChange={() => {}} initialReminder={existingReminder} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/title/i)).toHaveValue('Renew passport');
    expect(screen.getByLabelText(/category/i)).toHaveValue('Personal');
    expect(screen.getByLabelText(/due date/i)).toHaveValue('2026-08-16');
    expect(screen.getByLabelText(/priority/i)).toHaveValue('high');
    expect(screen.getByRole('heading', { name: /edit reminder/i })).toBeInTheDocument();
  });

  it('disables save until required fields are filled', async () => {
    const user = userEvent.setup();
    render(<ReminderForm open onOpenChange={() => {}} onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/title/i), 'Water plants');
    await user.type(screen.getByLabelText(/category/i), 'Home');
    await user.type(screen.getByLabelText(/due date/i), '2026-08-20');
    expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
  });

  it('calls onSubmit with the entered values', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ReminderForm open onOpenChange={() => {}} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/title/i), 'Water plants');
    await user.type(screen.getByLabelText(/category/i), 'Home');
    await user.selectOptions(screen.getByLabelText(/priority/i), 'low');
    await user.type(screen.getByLabelText(/due date/i), '2026-08-20');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledWith({ title: 'Water plants', category: 'Home', dueDate: '2026-08-20', priority: 'low' });
  });

  it('shows recurring options when Recurring is selected, and includes them on submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ReminderForm open onSubmit={onSubmit} onOpenChange={vi.fn()} />);

    await user.type(screen.getByLabelText(/title/i), 'Water plants');
    await user.type(screen.getByLabelText(/category/i), 'Home');
    await user.type(screen.getByLabelText(/due date/i), '2026-09-01');
    await user.click(screen.getByLabelText(/recurring/i));
    await user.selectOptions(screen.getByLabelText(/frequency/i), 'weekly');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Water plants',
        series: expect.objectContaining({ frequency: 'weekly', autoRenew: true }),
      })
    );
  });
});
