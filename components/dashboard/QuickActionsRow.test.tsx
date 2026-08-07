import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuickActionsRow } from './QuickActionsRow';

describe('QuickActionsRow', () => {
  it('renders Add Bill, Add Reminder, and Add Receipt actions', () => {
    render(<QuickActionsRow />);
    expect(screen.getByTestId('quick-action-bill')).toBeInTheDocument();
    expect(screen.getByTestId('quick-action-reminder')).toBeInTheDocument();
    expect(screen.getByTestId('quick-action-receipt')).toBeInTheDocument();
  });

  it('does not render Add Expense or Add Transaction (no backing feature)', () => {
    render(<QuickActionsRow />);
    expect(screen.queryByTestId('quick-action-expense')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quick-action-transaction')).not.toBeInTheDocument();
  });

  it('links each action to its real page', () => {
    render(<QuickActionsRow />);
    expect(screen.getByTestId('quick-action-bill')).toHaveAttribute('href', '/bills');
    expect(screen.getByTestId('quick-action-reminder')).toHaveAttribute('href', '/reminders');
    expect(screen.getByTestId('quick-action-receipt')).toHaveAttribute('href', '/receipts');
  });
});
