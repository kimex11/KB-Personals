import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

import { TabBar } from './TabBar';

describe('TabBar', () => {
  it('renders all six tabs', () => {
    render(<TabBar />);
    expect(screen.getByTestId('tab-home')).toBeInTheDocument();
    expect(screen.getByTestId('tab-budget')).toBeInTheDocument();
    expect(screen.getByTestId('tab-bills')).toBeInTheDocument();
    expect(screen.getByTestId('tab-accounts')).toBeInTheDocument();
    expect(screen.getByTestId('tab-reminders')).toBeInTheDocument();
    expect(screen.getByTestId('tab-receipts')).toBeInTheDocument();
  });

  it('marks the current route as active', () => {
    render(<TabBar />);
    expect(screen.getByTestId('tab-home')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('tab-budget')).not.toHaveAttribute('aria-current');
  });

  it('renders an animated indicator under the active tab', () => {
    render(<TabBar />);
    const homeLink = screen.getByTestId('tab-home');
    expect(within(homeLink).getByTestId('tab-indicator')).toBeInTheDocument();
  });
});
