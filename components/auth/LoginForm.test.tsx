import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  it('shows required errors when submitted empty', () => {
    render(<LoginForm />);
    fireEvent.submit(screen.getByTestId('login-form'));
    expect(screen.getByTestId('email-error')).toHaveTextContent('Email is required');
    expect(screen.getByTestId('password-error')).toHaveTextContent('Password is required');
  });

  it('shows an email format error for an invalid email', () => {
    render(<LoginForm />);
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'longenough' } });
    fireEvent.submit(screen.getByTestId('login-form'));
    expect(screen.getByTestId('email-error')).toHaveTextContent('Enter a valid email address');
  });

  it('shows a password length error for a short password', () => {
    render(<LoginForm />);
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'short' } });
    fireEvent.submit(screen.getByTestId('login-form'));
    expect(screen.getByTestId('password-error')).toHaveTextContent(
      'Password must be at least 8 characters'
    );
  });

  it('shows the stub message on a valid submit and clears prior errors', () => {
    render(<LoginForm />);
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'longenough' } });
    fireEvent.submit(screen.getByTestId('login-form'));
    expect(screen.getByTestId('login-stub-message')).toHaveTextContent('Sign-in coming soon');
    expect(screen.queryByTestId('email-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('password-error')).not.toBeInTheDocument();
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
