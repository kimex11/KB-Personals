'use client';

import { useState, type FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const MIN_PASSWORD_LENGTH = 8;

type Status = 'idle' | 'pending' | 'error' | 'success';

interface FormErrors {
  email?: string;
  password?: string;
}

export function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<Status>('idle');
  const [formError, setFormError] = useState<string | null>(null);

  function validate(): FormErrors {
    const nextErrors: FormErrors = {};
    if (!email.trim()) {
      nextErrors.email = 'Email is required';
    } else if (!EMAIL_PATTERN.test(email)) {
      nextErrors.email = 'Enter a valid email address';
    }
    if (!password) {
      nextErrors.password = 'Password is required';
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      nextErrors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }
    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setFormError(null);

    if (Object.keys(nextErrors).length > 0) {
      setStatus('idle');
      return;
    }

    setStatus('pending');
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setStatus('error');
      setFormError(error.message);
      return;
    }

    setStatus('success');
  }

  const isDisabled = email.trim() === '' || password === '' || status === 'pending';

  if (status === 'success') {
    return (
      <p data-testid="signup-success-message" className="text-center text-sm text-neutral-500">
        Check your email to confirm your account.
      </p>
    );
  }

  return (
    <form data-testid="signup-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          name="email"
          autoComplete="email"
          data-testid="email-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <p id="email-error" role="alert" data-testid="email-error" className="text-xs text-red-600">
            {errors.email}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          name="password"
          autoComplete="new-password"
          data-testid="password-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
        />
        {errors.password && (
          <p id="password-error" role="alert" data-testid="password-error" className="text-xs text-red-600">
            {errors.password}
          </p>
        )}
      </div>
      {formError && (
        <p data-testid="form-error" role="alert" className="text-sm text-status-critical">
          {formError}
        </p>
      )}
      <Button type="submit" disabled={isDisabled} className="mt-2 bg-neutral-900 text-white">
        {status === 'pending' ? 'Creating account…' : 'Sign up'}
      </Button>
    </form>
  );
}
