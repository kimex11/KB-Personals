import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuickActionsRow } from './QuickActionsRow';

describe('QuickActionsRow', () => {
  it('renders all five quick action buttons', () => {
    render(<QuickActionsRow />);
    expect(screen.getByTestId('quick-action-bill')).toBeInTheDocument();
    expect(screen.getByTestId('quick-action-expense')).toBeInTheDocument();
    expect(screen.getByTestId('quick-action-reminder')).toBeInTheDocument();
    expect(screen.getByTestId('quick-action-receipt')).toBeInTheDocument();
    expect(screen.getByTestId('quick-action-transaction')).toBeInTheDocument();
  });

  it('opens a "Coming soon" sheet when a quick action is tapped', () => {
    render(<QuickActionsRow />);
    fireEvent.click(screen.getByTestId('quick-action-bill'));
    expect(screen.getByTestId('quick-action-sheet-bill')).toHaveTextContent('Coming soon');
  });
});
