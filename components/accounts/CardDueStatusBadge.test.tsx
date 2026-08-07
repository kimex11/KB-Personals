import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardDueStatusBadge } from './CardDueStatusBadge';

describe('CardDueStatusBadge', () => {
  it('shows "Overdue" with the critical color class', () => {
    render(<CardDueStatusBadge status="overdue" />);
    const badge = screen.getByTestId('card-due-status-badge');
    expect(badge).toHaveTextContent('Overdue');
    expect(badge.className).toContain('text-status-critical');
  });

  it('shows "Due Soon" with the warning color class', () => {
    render(<CardDueStatusBadge status="due-soon" />);
    expect(screen.getByTestId('card-due-status-badge')).toHaveTextContent('Due Soon');
  });

  it('shows "Upcoming"', () => {
    render(<CardDueStatusBadge status="upcoming" />);
    expect(screen.getByTestId('card-due-status-badge')).toHaveTextContent('Upcoming');
  });
});
