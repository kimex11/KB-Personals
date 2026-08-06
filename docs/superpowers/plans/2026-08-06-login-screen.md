# Login Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a frontend-only login screen at `/login` (email + password, real client-side validation, stub submit) per `docs/superpowers/specs/2026-08-06-login-screen-design.md`, without the tabbed app's shell chrome.

**Architecture:** The existing root layout (`app/layout.tsx`) currently wraps every route in `<AppShell>` (tab bar + header) — added in Phase 1's Task 14. The login screen must NOT have that chrome, so this plan first moves the tabbed routes into a Next.js route group (`app/(shell)/`) with their own nested layout that applies `AppShell`, freeing the root layout to be shell-agnostic. `/login` then lives outside that group and gets the plain root layout only.

**Tech Stack:** Next.js (App Router, route groups), TypeScript, Tailwind v4, shadcn/ui (`Input`, `Label` — new; `Button` — existing), Vitest + React Testing Library.

## Global Constraints

- Frontend only — no backend, no Supabase call yet. The submit handler is a stub.
- No hardcoded values duplicated across files.
- Reuse existing design tokens: gold (`#B08D57`), ink (`#0B0B0C`), serif/sans fonts, `#FAFAFA` background — no new tokens.
- `/login` renders with no tab bar and no `AppShell` header chip.
- Email required + format-validated; password required + minimum 8 characters; validation runs on submit, not per-keystroke.
- On valid submit: show a "Sign-in coming soon" stub message, no navigation, no backend call, form not cleared.

---

### Task 1: Move Tabbed Routes Into a `(shell)` Route Group

**Files:**
- Create: `app/(shell)/layout.tsx`
- Modify: `app/layout.tsx` (remove `AppShell` wrapping)
- Move: `app/page.tsx` → `app/(shell)/page.tsx`, `app/page.test.tsx` → `app/(shell)/page.test.tsx`
- Move: `app/budget/page.tsx` → `app/(shell)/budget/page.tsx`, `app/budget/page.test.tsx` → `app/(shell)/budget/page.test.tsx`
- Move: `app/bills/page.tsx` → `app/(shell)/bills/page.tsx`, `app/bills/page.test.tsx` → `app/(shell)/bills/page.test.tsx`
- Move: `app/reminders/page.tsx` → `app/(shell)/reminders/page.tsx`, `app/reminders/page.test.tsx` → `app/(shell)/reminders/page.test.tsx`
- Move: `app/receipts/page.tsx` → `app/(shell)/receipts/page.tsx`, `app/receipts/page.test.tsx` → `app/(shell)/receipts/page.test.tsx`

**Interfaces:**
- Produces: `app/(shell)/layout.tsx` renders `<AppShell>{children}</AppShell>` for the 5 tabbed routes only. URLs are unaffected — `(shell)` is a route group, invisible in the path (`/`, `/budget`, `/bills`, `/reminders`, `/receipts` stay exactly as they are).

This is a structural move with existing test coverage, not new behavior — there's no new red/green cycle. Verification is "the full suite still passes after the move, and the app still renders identically."

- [ ] **Step 1: Create the `(shell)` route group and its layout**

Create the directory `app/(shell)/` and inside it, `app/(shell)/layout.tsx`:

```tsx
import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';

export default function ShellLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
```

- [ ] **Step 2: Move the 5 route files and their tests into the group**

```bash
mkdir -p "app/(shell)/budget" "app/(shell)/bills" "app/(shell)/reminders" "app/(shell)/receipts"
git mv app/page.tsx "app/(shell)/page.tsx"
git mv app/page.test.tsx "app/(shell)/page.test.tsx"
git mv app/budget/page.tsx "app/(shell)/budget/page.tsx"
git mv app/budget/page.test.tsx "app/(shell)/budget/page.test.tsx"
git mv app/bills/page.tsx "app/(shell)/bills/page.tsx"
git mv app/bills/page.test.tsx "app/(shell)/bills/page.test.tsx"
git mv app/reminders/page.tsx "app/(shell)/reminders/page.tsx"
git mv app/reminders/page.test.tsx "app/(shell)/reminders/page.test.tsx"
git mv app/receipts/page.tsx "app/(shell)/receipts/page.tsx"
git mv app/receipts/page.test.tsx "app/(shell)/receipts/page.test.tsx"
rmdir app/budget app/bills app/reminders app/receipts 2>/dev/null || true
```

None of the moved files' contents change — their imports are all absolute (`@/...`) or same-directory relative (`./page`), so the move doesn't break anything internally.

- [ ] **Step 3: Simplify the root layout to drop `AppShell`**

Update `app/layout.tsx` — remove the `AppShell` import and unwrap `{children}`:

```tsx
import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-serif' });
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'KB Personals — Financial Tracker',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="mx-auto min-h-screen max-w-md bg-[#FAFAFA] font-sans text-neutral-900">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Run the full suite to confirm nothing broke**

```bash
npm test
```

Expected: all existing test files pass, including the moved ones (now at their new paths) and `components/shell/AppShell.test.tsx` (untouched — it tests the `AppShell` component directly, not a route, so the move doesn't affect it).

- [ ] **Step 5: Verify the build still succeeds**

```bash
npm run build
```

Expected: succeeds, and the route list in the build output still shows `/`, `/budget`, `/bills`, `/reminders`, `/receipts` (the `(shell)` segment does not appear in the URLs).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move tabbed routes into a (shell) route group so AppShell isn't global"
```

---

### Task 2: Add shadcn `Input` and `Label` Primitives

**Files:**
- Create: `components/ui/input.tsx`, `components/ui/label.tsx` (via shadcn CLI)

**Interfaces:**
- Produces: `Input` and `Label` components importable at `@/components/ui/input` and `@/components/ui/label`.

Pure scaffolding, no red/green cycle — same as Phase 1's Task 1 pattern.

- [ ] **Step 1: Add the components**

```bash
npx shadcn@latest add input label
```

- [ ] **Step 2: Verify they were generated correctly**

```bash
cat components/ui/input.tsx
cat components/ui/label.tsx
```

Expected: both files exist and export `Input` / `Label` components respectively.

- [ ] **Step 3: Commit**

```bash
git add components/ui/input.tsx components/ui/label.tsx
git commit -m "chore: add shadcn Input and Label primitives"
```

---

### Task 3: `LoginForm` Component

**Files:**
- Create: `components/auth/LoginForm.tsx`
- Test: `components/auth/LoginForm.test.tsx`

**Interfaces:**
- Consumes: `Input` from `@/components/ui/input`; `Label` from `@/components/ui/label`; `Button` from `@/components/ui/button`.
- Produces: `LoginForm(): JSX.Element` — a self-contained form with no props, rendered with `data-testid="login-form"`, `data-testid="email-input"`, `data-testid="password-input"`, `data-testid="email-error"` (conditional), `data-testid="password-error"` (conditional), `data-testid="login-stub-message"` (conditional, shown after a valid submit).

- [ ] **Step 1: Write the failing tests**

Create `components/auth/LoginForm.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run components/auth/LoginForm.test.tsx
```

Expected: FAIL — `components/auth/LoginForm.tsx` does not exist yet.

- [ ] **Step 3: Write the component**

Create `components/auth/LoginForm.tsx`:

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const MIN_PASSWORD_LENGTH = 8;

interface FormErrors {
  email?: string;
  password?: string;
}

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setSubmitted(Object.keys(nextErrors).length === 0);
  }

  const isDisabled = email.trim() === '' || password === '';

  return (
    <form data-testid="login-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          data-testid="email-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {errors.email && (
          <p data-testid="email-error" className="text-xs text-red-600">
            {errors.email}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          data-testid="password-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {errors.password && (
          <p data-testid="password-error" className="text-xs text-red-600">
            {errors.password}
          </p>
        )}
      </div>
      <Button type="submit" disabled={isDisabled} className="mt-2 bg-neutral-900 text-white">
        Sign in
      </Button>
      {submitted && (
        <p data-testid="login-stub-message" className="text-center text-sm text-neutral-400">
          Sign-in coming soon
        </p>
      )}
    </form>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run components/auth/LoginForm.test.tsx
```

Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add components/auth/LoginForm.tsx components/auth/LoginForm.test.tsx
git commit -m "feat: add LoginForm with client-side validation and stub submit"
```

---

### Task 4: `/login` Route

**Files:**
- Create: `app/login/page.tsx`
- Test: `app/login/page.test.tsx`

**Interfaces:**
- Consumes: `LoginForm` from `@/components/auth/LoginForm`.
- Produces: the `/login` route, rendered with `data-testid="login-page"`. Sits outside the `(shell)` route group, so it does NOT get `AppShell` — no tab bar, no header chip.

- [ ] **Step 1: Write the failing test**

Create `app/login/page.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run app/login/page.test.tsx
```

Expected: FAIL — `app/login/page.tsx` does not exist yet.

- [ ] **Step 3: Write the route**

Create `app/login/page.tsx`:

```tsx
import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div
      data-testid="login-page"
      className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6"
    >
      <div className="flex flex-col items-center gap-3">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ink font-serif text-2xl text-gold">
          KB
        </span>
        <h1 className="font-serif text-2xl text-neutral-900">Sign in</h1>
      </div>
      <LoginForm />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run app/login/page.test.tsx
```

Expected: PASS

- [ ] **Step 5: Run the full suite, then manually verify in the browser**

```bash
npm test
npm run dev
```

Open `http://localhost:3000/login` and confirm: no tab bar, no header chip, KB monogram + "Sign in" heading, email/password fields, submit button disabled until both fields have input. Submit empty — confirm both required errors show. Enter an invalid email + valid password, submit — confirm the email format error shows. Enter a valid email + short password, submit — confirm the password length error shows. Enter valid email + valid (8+ char) password, submit — confirm the "Sign-in coming soon" message appears and no errors remain. Then navigate to `http://localhost:3000/` and confirm the tab bar and header are still present there (the route-group refactor from Task 1 didn't remove them from the tabbed routes).

- [ ] **Step 6: Commit**

```bash
git add app/login/page.tsx app/login/page.test.tsx
git commit -m "feat: add /login route composing LoginForm without app shell chrome"
```

---

## Spec Coverage Check

- Standalone `/login`, no tab bar/header chrome → Task 1 (route group refactor) + Task 4
- Email + password fields, format/length validation, submit-time validation → Task 3
- Stub "Sign-in coming soon" message on valid submit, no navigation → Task 3
- Reuses existing design tokens → Task 4 (and `LoginForm`'s Tailwind classes in Task 3)
- shadcn Input/Label primitives → Task 2
- Existing tabbed routes unaffected → Task 1, verified in Task 4 Step 5
