import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RowActionsMenu } from './RowActionsMenu';

describe('RowActionsMenu', () => {
  it('does not show Edit/Delete until the trigger is opened', () => {
    render(<RowActionsMenu label="Rent" onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole('button', { name: /actions for rent/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('reveals Edit and Delete when the trigger is opened', async () => {
    const user = userEvent.setup();
    render(<RowActionsMenu label="Rent" onEdit={vi.fn()} onDelete={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /actions for rent/i }));
    expect(await screen.findByRole('menuitem', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument();
  });

  it('calls onEdit when Edit is chosen', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<RowActionsMenu label="Rent" onEdit={onEdit} onDelete={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /actions for rent/i }));
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalled();
  });

  it('calls onDelete when Delete is chosen', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<RowActionsMenu label="Rent" onEdit={vi.fn()} onDelete={onDelete} />);
    await user.click(screen.getByRole('button', { name: /actions for rent/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalled();
  });

  it('omits the Edit item when onEdit is not given', async () => {
    const user = userEvent.setup();
    render(<RowActionsMenu label="Rent" onDelete={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /actions for rent/i }));
    expect(await screen.findByRole('menuitem', { name: /delete/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /edit/i })).not.toBeInTheDocument();
  });
});

describe('RowActionsMenu skip action', () => {
  it('renders a Skip menu item when onSkip is provided', async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(<RowActionsMenu label="Rent" onEdit={vi.fn()} onDelete={vi.fn()} onSkip={onSkip} />);
    await user.click(screen.getByRole('button', { name: /actions for rent/i }));
    const skipItem = await screen.findByRole('menuitem', { name: /skip/i });
    await user.click(skipItem);
    expect(onSkip).toHaveBeenCalled();
  });

  it('does not render a Skip menu item when onSkip is not provided', async () => {
    const user = userEvent.setup();
    render(<RowActionsMenu label="Rent" onEdit={vi.fn()} onDelete={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /actions for rent/i }));
    expect(screen.queryByRole('menuitem', { name: /skip/i })).not.toBeInTheDocument();
  });
});
