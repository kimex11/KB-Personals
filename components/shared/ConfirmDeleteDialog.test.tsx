import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

describe('ConfirmDeleteDialog', () => {
  it('renders the title and description', () => {
    render(
      <ConfirmDeleteDialog open onOpenChange={() => {}} title="Delete Visa Platinum?" description="This can't be undone." onConfirm={vi.fn()} />
    );
    expect(screen.getByRole('heading', { name: "Delete Visa Platinum?" })).toBeInTheDocument();
    expect(screen.getByText("This can't be undone.")).toBeInTheDocument();
  });

  it('calls onConfirm when the delete button is clicked', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ConfirmDeleteDialog open onOpenChange={() => {}} title="Delete?" description="Sure?" onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('closes after a successful delete', async () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ConfirmDeleteDialog open onOpenChange={onOpenChange} title="Delete?" description="Sure?" onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
