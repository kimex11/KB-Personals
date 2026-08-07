import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { signUp: vi.fn() },
  }),
}));

import SignupPage from './page';

describe('SignupPage', () => {
  it('renders the signup form and branding, with no app shell chrome', () => {
    render(<SignupPage />);
    expect(screen.getByTestId('signup-page')).toBeInTheDocument();
    expect(screen.getByTestId('signup-form')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Create account' })).toBeInTheDocument();
    expect(screen.queryByTestId('tab-bar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('app-header')).not.toBeInTheDocument();
  });
});
