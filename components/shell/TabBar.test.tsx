import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

import { TabBar } from './TabBar';

describe('TabBar', () => {
  it('renders all seven tabs', () => {
    render(<TabBar />);
    expect(screen.getByTestId('tab-home')).toBeInTheDocument();
    expect(screen.getByTestId('tab-expenses')).toBeInTheDocument();
    expect(screen.getByTestId('tab-plans')).toBeInTheDocument();
    expect(screen.getByTestId('tab-bills')).toBeInTheDocument();
    expect(screen.getByTestId('tab-accounts')).toBeInTheDocument();
    expect(screen.getByTestId('tab-reminders')).toBeInTheDocument();
    expect(screen.getByTestId('tab-receipts')).toBeInTheDocument();
  });

  it('marks the current route as active', () => {
    render(<TabBar />);
    expect(screen.getByTestId('tab-home')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('tab-expenses')).not.toHaveAttribute('aria-current');
  });

  it('renders an animated indicator under the active tab', () => {
    render(<TabBar />);
    const homeLink = screen.getByTestId('tab-home');
    expect(within(homeLink).getByTestId('tab-indicator')).toBeInTheDocument();
  });

  it('gives the active tab a tinted background pill that inactive tabs do not have', () => {
    render(<TabBar />);
    expect(screen.getByTestId('tab-home')).toHaveClass('bg-gold/10');
    expect(screen.getByTestId('tab-expenses')).not.toHaveClass('bg-gold/10');
  });
});
