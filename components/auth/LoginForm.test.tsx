import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginForm } from './LoginForm';

const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

const signInWithPasswordMock = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { signInWithPassword: signInWithPasswordMock },
  }),
}));

beforeEach(() => {
  pushMock.mockClear();
  refreshMock.mockClear();
  signInWithPasswordMock.mockClear();
});

describe('LoginForm', () => {
  it('shows required errors when submitted empty', () => {
    render(<LoginForm />);
    fireEvent.submit(screen.getByTestId('login-form'));
    expect(screen.getByTestId('email-error')).toHaveTextContent('Email is required');
    expect(screen.getByTestId('password-error')).toHaveTextContent('Password is required');
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });

  it('shows an email format error for an invalid email', () => {
    render(<LoginForm />);
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'longenough' } });
    fireEvent.submit(screen.getByTestId('login-form'));
    expect(screen.getByTestId('email-error')).toHaveTextContent('Enter a valid email address');
  });

  it('calls signInWithPassword and redirects to / on success', async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });
    render(<LoginForm />);
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'longenough' } });
    fireEvent.submit(screen.getByTestId('login-form'));

    await waitFor(() =>
      expect(signInWithPasswordMock).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'longenough',
      })
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/'));
  });

  it('shows the Supabase error message on failed sign-in', async () => {
    signInWithPasswordMock.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    render(<LoginForm />);
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'longenough' } });
    fireEvent.submit(screen.getByTestId('login-form'));

    await waitFor(() =>
      expect(screen.getByTestId('form-error')).toHaveTextContent('Invalid login credentials')
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('disables the submit button until both fields are filled', () => {
    render(<LoginForm />);
    const submitButton = screen.getByRole('button', { name: 'Sign in' });
    expect(submitButton).toBeDisabled();
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'user@example.com' } });
    expect(submitButton).toBeDisabled();
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'longenough' } });
    expect(submitButton).not.toBeDisabled();
  });
});
