import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpendingSnapshot } from './SpendingSnapshot';

describe('SpendingSnapshot', () => {
  it('shows spent-of-budgeted text and remaining amount', () => {
    render(<SpendingSnapshot budgeted={3000} spent={1800} remaining={1200} />);
    expect(screen.getByTestId('spending-snapshot')).toHaveTextContent('₱1800 of ₱3000 spent');
    expect(screen.getByTestId('spending-snapshot')).toHaveTextContent('₱1200 remaining');
  });

  it('sets the progress fill width proportional to spent/budgeted', () => {
    render(<SpendingSnapshot budgeted={2000} spent={1000} remaining={1000} />);
    expect(screen.getByTestId('spending-progress-fill')).toHaveStyle({ width: '50%' });
  });

  it('caps the progress fill at 100% when overspent', () => {
    render(<SpendingSnapshot budgeted={1000} spent={1500} remaining={-500} />);
    expect(screen.getByTestId('spending-progress-fill')).toHaveStyle({ width: '100%' });
  });

  it('shows the remaining amount in the critical color when negative', () => {
    render(<SpendingSnapshot budgeted={1000} spent={1500} remaining={-500} />);
    expect(screen.getByTestId('spending-progress-fill').className).toContain('bg-status-critical');
  });

  it('links to the Budget tab', () => {
    render(<SpendingSnapshot budgeted={1000} spent={500} remaining={500} />);
    expect(screen.getByRole('link', { name: 'View Budget' })).toHaveAttribute('href', '/budget');
  });
});
