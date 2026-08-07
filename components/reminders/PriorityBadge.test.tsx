import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PriorityBadge } from './PriorityBadge';

describe('PriorityBadge', () => {
  it('shows "High" with the critical color class', () => {
    render(<PriorityBadge priority="high" />);
    const badge = screen.getByTestId('priority-badge');
    expect(badge).toHaveTextContent('High');
    expect(badge.className).toContain('text-status-critical');
  });

  it('shows "Medium" with the warning color class', () => {
    render(<PriorityBadge priority="medium" />);
    const badge = screen.getByTestId('priority-badge');
    expect(badge).toHaveTextContent('Medium');
    expect(badge.className).toContain('text-status-warning');
  });

  it('shows "Low" with a neutral color class', () => {
    render(<PriorityBadge priority="low" />);
    expect(screen.getByTestId('priority-badge')).toHaveTextContent('Low');
  });
});
