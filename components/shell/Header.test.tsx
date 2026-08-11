import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/budget',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { Header } from './Header';

describe('Header', () => {
  it('shows the title matching the current route', () => {
    render(<Header />);
    expect(screen.getByText('Budget')).toBeInTheDocument();
  });

  it('renders the KB monogram chip', () => {
    render(<Header />);
    expect(screen.getByText('KB')).toBeInTheDocument();
  });

  it('renders a link to the Activity Log', () => {
    render(<Header />);
    expect(screen.getByRole('link', { name: /activity log/i })).toHaveAttribute('href', '/activity');
  });
});
