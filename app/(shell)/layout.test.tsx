import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

import ShellLayout from './layout';

describe('ShellLayout', () => {
  it('wraps its children in the AppShell chrome', () => {
    render(
      <ShellLayout>
        <p>page content</p>
      </ShellLayout>
    );
    expect(screen.getByTestId('app-header')).toBeInTheDocument();
    expect(screen.getByTestId('tab-bar')).toBeInTheDocument();
    expect(screen.getByText('page content')).toBeInTheDocument();
  });
});
