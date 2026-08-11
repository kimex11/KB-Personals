import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecordPaymentForm } from './RecordPaymentForm';

describe('RecordPaymentForm', () => {
  it('renders empty amount/method/notes fields and a heading', () => {
    render(<RecordPaymentForm open onOpenChange={() => {}} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/amount/i)).toHaveValue(null);
    expect(screen.getByLabelText(/payment method/i)).toHaveValue('');
    expect(screen.getByLabelText(/notes/i)).toHaveValue('');
    expect(screen.getByRole('heading', { name: /record payment/i })).toBeInTheDocument();
  });

  it('disables the submit button until a positive amount and a paid-on date are set', async () => {
    const user = userEvent.setup();
    render(<RecordPaymentForm open onOpenChange={() => {}} onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^record payment$/i })).toBeDisabled();

    await user.type(screen.getByLabelText(/amount/i), '300');
    expect(screen.getByRole('button', { name: /^record payment$/i })).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText(/paid on/i), { target: { value: '' } });
    expect(screen.getByRole('button', { name: /^record payment$/i })).toBeDisabled();
  });

  it('rejects a zero or negative amount', async () => {
    const user = userEvent.setup();
    render(<RecordPaymentForm open onOpenChange={() => {}} onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/amount/i), '0');
    expect(screen.getByRole('button', { name: /record payment/i })).toBeDisabled();
  });

  it('calls onSubmit with the entered values, converting the paid-on field to an ISO string', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<RecordPaymentForm open onOpenChange={() => {}} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/amount/i), '300');
    fireEvent.change(screen.getByLabelText(/paid on/i), { target: { value: '2026-08-10T10:00' } });
    await user.type(screen.getByLabelText(/payment method/i), 'Bank transfer');
    await user.type(screen.getByLabelText(/notes/i), 'Paid from savings');
    await user.click(screen.getByRole('button', { name: /record payment/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      amount: 300,
      paidAt: new Date('2026-08-10T10:00').toISOString(),
      method: 'Bank transfer',
      notes: 'Paid from savings',
    });
  });

  it('sends null for method and notes when left blank', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<RecordPaymentForm open onOpenChange={() => {}} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/amount/i), '150');
    fireEvent.change(screen.getByLabelText(/paid on/i), { target: { value: '2026-08-10T10:00' } });
    await user.click(screen.getByRole('button', { name: /record payment/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 150, method: null, notes: null })
    );
  });
});
