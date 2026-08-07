import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { signInWithPassword: vi.fn() },
  }),
}));

import LoginPage from './page';

describe('LoginPage', () => {
  it('renders the login form and branding, with no app shell chrome', () => {
    render(<LoginPage />);
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.getByTestId('login-form')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByTestId('tab-bar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('app-header')).not.toBeInTheDocument();
  });
});
