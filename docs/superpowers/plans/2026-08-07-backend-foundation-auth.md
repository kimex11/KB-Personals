# Backend Foundation & Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire real Supabase Auth into the Financial Tracker app (replacing the stub login flow) with a minimal `profiles` schema foundation, per `docs/superpowers/specs/2026-08-07-backend-foundation-auth-design.md`.

**Architecture:** `@supabase/ssr` browser/server clients + Next.js middleware for session refresh and route protection. A single `profiles` table with RLS, auto-populated via a Postgres trigger on `auth.users` insert. Migrations applied via a direct `pg` connection to the Supabase session pooler (IPv4; the direct `db.*.supabase.co` host is IPv6-only and unreachable from this network).

**Tech Stack:** Next.js, TypeScript, `@supabase/ssr`, `@supabase/supabase-js`, `pg` (migration tooling only, devDependency), `dotenv` (devDependency), Vitest + React Testing Library.

## Global Constraints

- Credentials live only in `.env.local` (already gitignored, confirmed). Never print, log, or embed the database password or Supabase keys in source files, commit messages, or test fixtures.
- `useCalendarEvents()` and `useBudget()` are untouched — Home and Budget keep reading mock data this phase.
- RLS is mandatory on every new table — `profiles` must only be readable/writable by its own owner.
- Reuse existing design tokens and the `components/ui/{input,label,button}` primitives — no new visual system.
- Session/auth `status` is `'idle' | 'pending' | 'error' | 'success'` — never a bare boolean.
- Middleware and full session lifecycle are not unit-tested (Edge runtime); verified manually in the final task.

---

### Task 1: Supabase Client Wiring

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Modify: `package.json` (add `@supabase/ssr`, `@supabase/supabase-js`)

**Interfaces:**
- Produces: `createClient()` from `lib/supabase/client.ts` (browser, sync) and `createClient()` from `lib/supabase/server.ts` (server, async — reads/writes cookies).

Pure SDK wrapper setup — no red/green cycle (thin, untestable-in-isolation config, same treatment as the shadcn `components/ui/*` primitives).

- [ ] **Step 1: Install dependencies**

```bash
npm install @supabase/ssr @supabase/supabase-js
```

- [ ] **Step 2: Write the browser client**

Create `lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: Write the server client**

Create `lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — middleware handles session refresh instead.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 4: Verify the project still builds and type-checks**

```bash
npx tsc --noEmit
npm run build
```

Expected: both succeed (these files aren't imported anywhere yet, so this just confirms no syntax/type errors).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json lib/supabase/client.ts lib/supabase/server.ts
git commit -m "feat: add Supabase browser and server client wrappers"
```

---

### Task 2: `profiles` Migration

**Files:**
- Create: `supabase/migrations/0001_profiles.sql`
- Create: `scripts/db/apply-migration.mjs`
- Modify: `package.json` (add `pg`, `dotenv` as devDependencies)

**Interfaces:**
- Produces: a `public.profiles` table with RLS enabled, two policies (select/update own row), and an `on_auth_user_created` trigger on `auth.users` that inserts a matching `profiles` row.

- [ ] **Step 1: Install migration tooling**

```bash
npm install -D pg @types/pg dotenv
```

- [ ] **Step 2: Write the migration SQL**

Create `supabase/migrations/0001_profiles.sql`:

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 3: Write the migration runner script**

Create `scripts/db/apply-migration.mjs`:

```js
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const [, , migrationFile] = process.argv;
if (!migrationFile) {
  console.error('Usage: node scripts/db/apply-migration.mjs <path-to-sql-file>');
  process.exit(1);
}

const sql = readFileSync(migrationFile, 'utf-8');
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();
  await client.query(sql);
  console.log(`Applied migration: ${migrationFile}`);
  await client.end();
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
```

- [ ] **Step 4: Apply the migration**

```bash
node scripts/db/apply-migration.mjs supabase/migrations/0001_profiles.sql
```

Expected: `Applied migration: supabase/migrations/0001_profiles.sql`

- [ ] **Step 5: Verify the table and trigger exist**

```bash
node -e "
import('dotenv').then(({config}) => config({ path: '.env.local' })).then(async () => {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const table = await client.query(\"select column_name from information_schema.columns where table_schema='public' and table_name='profiles' order by ordinal_position\");
  console.log('profiles columns:', table.rows.map(r => r.column_name));
  const trigger = await client.query(\"select tgname from pg_trigger where tgname='on_auth_user_created'\");
  console.log('trigger exists:', trigger.rows.length === 1);
  await client.end();
});
"
```

Expected: `profiles columns:` lists `id, email, display_name, created_at, updated_at`; `trigger exists: true`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json supabase/migrations/0001_profiles.sql scripts/db/apply-migration.mjs
git commit -m "feat: add profiles table migration with RLS and auto-create trigger"
```

---

### Task 3: Auth Middleware

**Files:**
- Create: `middleware.ts` (project root)

**Interfaces:**
- Produces: request-level session refresh; redirects unauthenticated visitors away from `/`, `/budget`, `/bills`, `/reminders`, `/receipts` to `/login`; redirects authenticated visitors away from `/login`, `/signup` to `/`.

No automated test (Edge runtime) — verified manually in Task 7.

- [ ] **Step 1: Write the middleware**

Create `middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PATHS = ['/', '/budget', '/bills', '/reminders', '/receipts'];
const AUTH_PATHS = ['/login', '/signup'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && PROTECTED_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user && AUTH_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

- [ ] **Step 2: Verify the build succeeds**

```bash
npx tsc --noEmit
npm run build
```

Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: add auth middleware for session refresh and route protection"
```

---

### Task 4: Wire Real Auth into `LoginForm`

**Files:**
- Modify: `components/auth/LoginForm.tsx`
- Modify: `components/auth/LoginForm.test.tsx`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/client`; `useRouter` from `next/navigation`.
- Produces: `LoginForm()` unchanged externally (`data-testid="login-form"`, `email-input`, `password-input`, `email-error`, `password-error`), plus new `data-testid="form-error"` (server-side auth error) and a `status` state replacing the old `submitted: boolean`.

- [ ] **Step 1: Write the failing tests**

Replace `components/auth/LoginForm.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run components/auth/LoginForm.test.tsx
```

Expected: FAIL — current `LoginForm` has no `form-error` test id and doesn't call `signInWithPassword`.

- [ ] **Step 3: Rewrite the component**

Replace `components/auth/LoginForm.tsx`:

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
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

export function LoginForm() {
  const router = useRouter();
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setStatus('error');
      setFormError(error.message);
      return;
    }

    setStatus('success');
    router.push('/');
    router.refresh();
  }

  const isDisabled = email.trim() === '' || password === '' || status === 'pending';

  return (
    <form data-testid="login-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          data-testid="email-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <p id="email-error" data-testid="email-error" role="alert" className="text-xs text-red-600">
            {errors.email}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          data-testid="password-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
        />
        {errors.password && (
          <p id="password-error" data-testid="password-error" role="alert" className="text-xs text-red-600">
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
        {status === 'pending' ? 'Signing in…' : 'Sign in'}
      </Button>
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
git commit -m "feat: wire LoginForm to real Supabase auth"
```

---

### Task 5: `SignupForm` & `/signup` Route

**Files:**
- Create: `components/auth/SignupForm.tsx`
- Create: `components/auth/SignupForm.test.tsx`
- Create: `app/signup/page.tsx`
- Create: `app/signup/page.test.tsx`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/client`.
- Produces: `SignupForm()`, `data-testid="signup-form"`, same field test ids as `LoginForm`, `data-testid="signup-success-message"` (shown after successful sign-up instead of redirecting). `/signup` route, `data-testid="signup-page"`.

- [ ] **Step 1: Write the failing tests**

Create `components/auth/SignupForm.test.tsx`:

```tsx
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
```

Create `app/signup/page.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run components/auth/SignupForm.test.tsx app/signup/page.test.tsx
```

Expected: FAIL — neither file exists yet.

- [ ] **Step 3: Write `SignupForm`**

Create `components/auth/SignupForm.tsx`:

```tsx
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
          name="email"
          type="email"
          autoComplete="email"
          data-testid="email-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <p id="email-error" data-testid="email-error" role="alert" className="text-xs text-red-600">
            {errors.email}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          data-testid="password-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
        />
        {errors.password && (
          <p id="password-error" data-testid="password-error" role="alert" className="text-xs text-red-600">
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
```

- [ ] **Step 4: Write the `/signup` route**

Create `app/signup/page.tsx`:

```tsx
import { SignupForm } from '@/components/auth/SignupForm';

export default function SignupPage() {
  return (
    <div
      data-testid="signup-page"
      className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6"
    >
      <div className="flex flex-col items-center gap-3">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ink font-serif text-2xl text-gold">
          KB
        </span>
        <h1 className="font-serif text-2xl text-neutral-900">Create account</h1>
      </div>
      <SignupForm />
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run components/auth/SignupForm.test.tsx app/signup/page.test.tsx
```

Expected: PASS (6/6)

- [ ] **Step 6: Commit**

```bash
git add components/auth/SignupForm.tsx components/auth/SignupForm.test.tsx app/signup/page.tsx app/signup/page.test.tsx
git commit -m "feat: add SignupForm and /signup route"
```

---

### Task 6: `LogoutButton`, Wired into the Header

**Files:**
- Create: `components/auth/LogoutButton.tsx`
- Create: `components/auth/LogoutButton.test.tsx`
- Modify: `components/shell/Header.tsx`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/client`; `useRouter` from `next/navigation`.
- Produces: `LogoutButton()`, `data-testid="logout-button"`. Rendered inside `Header`, right-aligned.

- [ ] **Step 1: Write the failing test**

Create `components/auth/LogoutButton.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LogoutButton } from './LogoutButton';

const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

const signOutMock = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: signOutMock } }),
}));

beforeEach(() => {
  pushMock.mockClear();
  refreshMock.mockClear();
  signOutMock.mockClear();
});

describe('LogoutButton', () => {
  it('signs out and redirects to /login when clicked', async () => {
    signOutMock.mockResolvedValue({ error: null });
    render(<LogoutButton />);
    fireEvent.click(screen.getByTestId('logout-button'));
    await waitFor(() => expect(signOutMock).toHaveBeenCalled());
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/login'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run components/auth/LogoutButton.test.tsx
```

Expected: FAIL — `components/auth/LogoutButton.tsx` does not exist yet.

- [ ] **Step 3: Write the component**

Create `components/auth/LogoutButton.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <Button
      type="button"
      data-testid="logout-button"
      onClick={handleLogout}
      className="bg-transparent text-neutral-500 hover:text-neutral-900"
    >
      Log out
    </Button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run components/auth/LogoutButton.test.tsx
```

Expected: PASS

- [ ] **Step 5: Wire it into `Header`**

In `components/shell/Header.tsx`, add the import and render `LogoutButton` right-aligned:

```tsx
'use client';

import { usePathname } from 'next/navigation';
import { TAB_ITEMS } from './tab-config';
import { LogoutButton } from '@/components/auth/LogoutButton';

export function Header() {
  const pathname = usePathname();
  const title = TAB_ITEMS.find((tab) => tab.href === pathname)?.label ?? 'Home';

  return (
    <header data-testid="app-header" className="flex items-center gap-3 px-4 pb-2 pt-6">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-serif text-sm text-gold">
        KB
      </span>
      <h1 className="font-serif text-xl text-neutral-900">{title}</h1>
      <div className="ml-auto">
        <LogoutButton />
      </div>
    </header>
  );
}
```

- [ ] **Step 6: Run the existing `Header` and `AppShell` tests to confirm no regressions**

```bash
npx vitest run components/shell/Header.test.tsx components/shell/AppShell.test.tsx
```

Expected: PASS — neither test clicks the logout button, so no new mocking is required; this just confirms `LogoutButton`'s addition doesn't break existing rendering assertions.

- [ ] **Step 7: Commit**

```bash
git add components/auth/LogoutButton.tsx components/auth/LogoutButton.test.tsx components/shell/Header.tsx
git commit -m "feat: add LogoutButton and wire it into the Header"
```

---

### Task 7: Full Test Suite & Manual End-to-End Verification

**Files:** None (verification only).

- [ ] **Step 1: Run the full automated suite**

```bash
npm test
npx tsc --noEmit
npx eslint .
npm run build
```

Expected: all four succeed.

- [ ] **Step 2: Create a test account and verify the `profiles` trigger**

Start the dev server (`npm run dev`), visit `/signup`, sign up with a real test email you control (e.g. a `+test` alias of your own address) and a password of at least 8 characters. Confirm the "Check your email to confirm your account." message appears.

Then verify the `profiles` row was created immediately (the trigger fires on `auth.users` insert regardless of email-confirmation status):

```bash
node -e "
import('dotenv').then(({config}) => config({ path: '.env.local' })).then(async () => {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const result = await client.query('select id, email, created_at from public.profiles order by created_at desc limit 5');
  console.log(result.rows);
  await client.end();
});
"
```

Expected: your test account's email appears in the output.

- [ ] **Step 3: Confirm the test account's email for login testing**

Since a full inbox-based confirmation isn't practical to script, confirm the account directly via SQL (this is your own test data in your own project — acceptable for local verification only, never do this against real user data in production):

```bash
node -e "
import('dotenv').then(({config}) => config({ path: '.env.local' })).then(async () => {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(\"update auth.users set email_confirmed_at = now() where email = \$1\", ['YOUR_TEST_EMAIL_HERE']);
  console.log('confirmed');
  await client.end();
});
"
```

Replace `YOUR_TEST_EMAIL_HERE` with the email used in Step 2.

- [ ] **Step 4: Verify login, logout, and route protection**

In the browser: visit `/login`, log in with the test account — confirm redirect to `/` with full shell chrome (tab bar, header) visible. Confirm a "Log out" control appears in the header. Click it — confirm redirect to `/login`. While logged out, attempt to visit `/` directly — confirm redirect back to `/login`. Log in again, then visit `/login` directly while still authenticated — confirm redirect to `/`.

- [ ] **Step 5: Confirm Home and Budget still show mock data unchanged**

While logged in, visit `/` and `/budget` — confirm both render exactly as before (calendar with mock events, budget categories with mock spend) — this phase did not touch either data source.

No commit for this task — it's verification only. If any step fails, fix the underlying issue in the relevant earlier task's files, re-run that task's tests, and re-verify here.

---

## Spec Coverage Check

- Database connectivity via pooler (IPv6 direct connection unreachable) → documented in spec, exercised by Task 2/7
- `profiles` table, RLS, auto-create trigger → Task 2
- Browser/server Supabase clients → Task 1
- Middleware session refresh + route protection both directions → Task 3
- Real login with `status` enum + form-level error → Task 4
- Sign-up screen with email-confirmation messaging → Task 5
- Logout → Task 6
- Home/Budget mock data untouched → verified in Task 7, no code changes to `lib/mock-data.ts` or `lib/budget-data.ts` anywhere in this plan
