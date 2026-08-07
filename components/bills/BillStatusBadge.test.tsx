import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BillStatusBadge } from './BillStatusBadge';

describe('BillStatusBadge', () => {
  it('shows the correct label for each status', () => {
    render(<BillStatusBadge status="overdue" />);
    expect(screen.getByTestId('bill-status-badge')).toHaveTextContent('Overdue');
  });

  it('applies the critical color class for overdue', () => {
    render(<BillStatusBadge status="overdue" />);
    expect(screen.getByTestId('bill-status-badge').className).toContain('text-status-critical');
  });

  it('applies the warning color class for due-soon', () => {
    render(<BillStatusBadge status="due-soon" />);
    expect(screen.getByTestId('bill-status-badge')).toHaveTextContent('Due Soon');
    expect(screen.getByTestId('bill-status-badge').className).toContain('text-status-warning');
  });

  it('applies the success color class for paid', () => {
    render(<BillStatusBadge status="paid" />);
    expect(screen.getByTestId('bill-status-badge')).toHaveTextContent('Paid');
    expect(screen.getByTestId('bill-status-badge').className).toContain('text-status-success');
  });

  it('shows the upcoming label', () => {
    render(<BillStatusBadge status="upcoming" />);
    expect(screen.getByTestId('bill-status-badge')).toHaveTextContent('Upcoming');
  });
});
