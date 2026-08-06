import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

import { TabBar } from './TabBar';

describe('TabBar', () => {
  it('renders all five tabs', () => {
    render(<TabBar />);
    expect(screen.getByTestId('tab-home')).toBeInTheDocument();
    expect(screen.getByTestId('tab-budget')).toBeInTheDocument();
    expect(screen.getByTestId('tab-bills')).toBeInTheDocument();
    expect(screen.getByTestId('tab-reminders')).toBeInTheDocument();
    expect(screen.getByTestId('tab-receipts')).toBeInTheDocument();
  });

  it('marks the current route as active', () => {
    render(<TabBar />);
    expect(screen.getByTestId('tab-home')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('tab-budget')).not.toHaveAttribute('aria-current');
  });
});
