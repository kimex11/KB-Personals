import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SignupForm } from './SignupForm';

const signUpMock = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { signUp: signUpMock },
  }),
}));

beforeEach(() => {
  signUpMock.mockClear();
});

describe('SignupForm', () => {
  it('shows required errors when submitted empty', () => {
    render(<SignupForm />);
    fireEvent.submit(screen.getByTestId('signup-form'));
    expect(screen.getByTestId('email-error')).toHaveTextContent('Email is required');
    expect(screen.getByTestId('password-error')).toHaveTextContent('Password is required');
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it('calls signUp and shows the check-your-email message on success', async () => {
    signUpMock.mockResolvedValue({ error: null });
    render(<SignupForm />);
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'longenough' } });
    fireEvent.submit(screen.getByTestId('signup-form'));

    await waitFor(() =>
      expect(signUpMock).toHaveBeenCalledWith({ email: 'user@example.com', password: 'longenough' })
    );
    await waitFor(() =>
      expect(screen.getByTestId('signup-success-message')).toHaveTextContent(
        'Check your email to confirm your account.'
      )
    );
  });

  it('shows the Supabase error message on failed sign-up', async () => {
    signUpMock.mockResolvedValue({ error: { message: 'User already registered' } });
    render(<SignupForm />);
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'longenough' } });
    fireEvent.submit(screen.getByTestId('signup-form'));

    await waitFor(() =>
      expect(screen.getByTestId('form-error')).toHaveTextContent('User already registered')
    );
    expect(screen.queryByTestId('signup-success-message')).not.toBeInTheDocument();
  });
});
