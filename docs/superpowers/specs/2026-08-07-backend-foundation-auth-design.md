# Financial Tracker — Backend Foundation & Auth Design

Date: 2026-08-07
Status: Approved (pending final spec review)

## Scope

Phase 1 of the real Supabase backend integration (source: `Secrets.md`). Establishes the database connection, a minimal schema foundation, and real authentication — replacing the stub login flow with working Supabase Auth. This is the first of several phases; calendar data, budget data, and receipt storage each get their own follow-up spec.

Out of scope this phase: calendar/event data migration (Home stays on mock data), budget data migration (Budget stays on mock data), receipt upload/storage, social login, password reset flow, multi-factor auth.

## Why Phased

The full request in `Secrets.md` spans four independent subsystems (auth, calendar data, budget data, receipt storage) each with their own schema, RLS policies, and frontend wiring. Building all four in one pass would produce an unreviewable diff. Each phase follows the same spec → plan → build cycle already used for Home, Login, and Budget.

## Project & Connectivity

- Supabase project: `qxkgjxxuoxczyuvhcbal` (ap-southeast-1), free tier
- Direct connection (`db.<ref>.supabase.co`) is IPv6-only and unreachable from this network — using the **session pooler** (`aws-0-ap-southeast-1.pooler.supabase.com:5432`, IPv4) instead, confirmed working
- Credentials live in `.env.local` (gitignored, confirmed never committed) — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL` (pooler), `DIRECT_URL` (direct, kept for reference/future IPv6-capable environments)
- Migrations applied via the Supabase CLI (already installed locally) against the pooler connection

## Database Schema

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

A `profiles` row is auto-created via trigger whenever a new `auth.users` row appears (i.e., on sign-up). RLS restricts every profile to its own owner — no user can read or write another user's profile row. Applied as a versioned migration under `supabase/migrations/`.

## Supabase Client Wiring

- `lib/supabase/client.ts` — browser client (`createBrowserClient` from `@supabase/ssr`), used by client components
- `lib/supabase/server.ts` — server client (`createServerClient`, cookie-aware), used by server components and middleware
- `middleware.ts` — runs on every request to the `(shell)` route group: refreshes the session, redirects unauthenticated visitors to `/login`; redirects already-authenticated visitors away from `/login` and `/signup` to `/`

## Auth Flows

- **Login** (`components/auth/LoginForm.tsx`, modified): submit handler calls `supabase.auth.signInWithPassword({ email, password })`. State reshaped from the current `submitted: boolean` to `status: 'idle' | 'pending' | 'error' | 'success'`, with a form-level error message slot displaying Supabase's returned error (e.g. "Invalid login credentials"). On success, redirect to `/`.
- **Sign up** (`components/auth/SignupForm.tsx`, new + `app/signup/page.tsx`, new): same field shape and validation as login, calls `supabase.auth.signUp({ email, password })`. Supabase's default email-confirmation flow applies (included on free tier) — on success, show a "check your email to confirm" message rather than redirecting immediately.
- **Logout** (`components/shell/LogoutButton.tsx`, new): calls `supabase.auth.signOut()`, redirects to `/login`. Placed in the shell (header or a settings affordance — exact placement decided at implementation time, following existing header conventions).
- `useCalendarEvents()` and `useBudget()` are untouched this phase — Home and Budget continue reading mock data. Only authentication becomes real.

## Testing

- Vitest + RTL for `LoginForm`, `SignupForm`, `LogoutButton` against a **mocked** Supabase client (same mocking pattern already used for `useCalendarEvents`) — verifies validation, `status` transitions, error-message display, and that the right Supabase/router calls happen, without hitting the network.
- Middleware and the full session/redirect lifecycle are not practically unit-testable (Next.js Edge runtime) — verified manually: sign up with a real test account, confirm the corresponding `profiles` row exists in the database, log out and confirm redirect to `/login`, attempt to visit `/` while logged out and confirm redirect back to `/login`, log back in and confirm redirect to `/`.

## Security Notes

- The Supabase secret/service-role key is never used client-side and is not currently held in full (Secrets.md's copy was truncated) — this phase only needs the publishable/anon key and the database connection string, neither of which grants elevated privileges beyond what RLS allows.
- `.env.local` is confirmed gitignored; `Secrets.md` itself was added to `.gitignore` and confirmed never committed to any branch or pushed to the remote.
- Password reuse between the Supabase account login and the database password was flagged to the user; they chose to proceed without rotating for now.

## Open Questions / Future Phases

- Calendar/event data migration (replace `lib/mock-data.ts` with real Supabase-backed data)
- Budget data migration (replace `lib/budget-data.ts` with real Supabase-backed data)
- Receipt upload + Supabase Storage + OCR extraction
- Password reset flow
- Logout button exact placement in the UI
