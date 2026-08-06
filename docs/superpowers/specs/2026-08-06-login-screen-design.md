# Financial Tracker — Login Screen Design

Date: 2026-08-06
Status: Approved (pending final spec review)

## Scope

A frontend-only login screen at `/login`. Email + password fields, client-side validation, and a stub submit flow — no real authentication yet. This is the frontend groundwork for a future Supabase Auth integration.

Out of scope: sign up, forgot password, social login, session/auth state, route gating (Home and the tab bar remain open and ungated), and any real backend call.

## Goals

- A premium, on-brand entry screen consistent with the Home screen's visual language (gold/ink/serif design tokens established in Phase 1)
- Real client-side validation (not decorative) so the form behaves correctly once wired to Supabase
- A clean, single, well-isolated point where the future `supabase.auth.signInWithPassword()` call will replace the stub — no other code should need to change when that happens

## Placement

- New route: `app/login/page.tsx`
- Standalone — does **not** render inside `AppShell` (no tab bar, no header chip). A login screen is an entry surface, not one of the app's 5 tabs.
- Not linked from anywhere in the current navigation yet; reachable directly by URL. No route gating — Home and the tab bar stay fully open.

## Screen Layout

- Centered column, same `max-w-md` phone-width shell as the rest of the app, on the `#FAFAFA` background
- KB monogram (larger than the Home header's small chip — this is the entry screen's own branding moment), "Sign in" heading (serif)
- Email field, password field, submit button
- A stub message area below the button, hidden by default

## Fields & Validation

- **Email:** required; format-validated (`type="email"` input plus a regex check: `/^\S+@\S+\.\S+$/`)
- **Password:** required; minimum 8 characters (client-side only — no complexity rules, since there's no backend to enforce anything real yet)
- Validation runs on submit (not on every keystroke); inline error text appears below each invalid field, small and in a muted-red tone consistent with the app's existing text scale
- Submit button is disabled while either field is empty
- On a valid submit: no navigation, no backend call. A "Sign-in coming soon" message appears in the stub message area — consistent with the Home screen's existing "+" add-event stub pattern. The form is not cleared or reset.

## Architecture

```
app/
  login/
    page.tsx              the /login route, renders LoginForm centered, no AppShell
components/
  auth/
    LoginForm.tsx          fields, validation, submit stub handler
components/ui/
  input.tsx                shadcn primitive (new — via CLI, same pattern as Button/Sheet)
  label.tsx                shadcn primitive (new — via CLI)
```

- Reuses existing design tokens (gold, ink, serif/sans, `#FAFAFA`) — no new tokens needed
- `input.tsx`/`label.tsx` added via `npx shadcn@latest add input label`, matching how Button/Sheet were added in Phase 1 Task 1
- **Future Supabase swap point:** `LoginForm`'s submit handler is the single place that gets replaced with a real `supabase.auth.signInWithPassword({ email, password })` call. Validation, layout, and error display all stay as-is.

## Testing

- Vitest + React Testing Library, matching the Phase 1 pattern
- Cases: submitting with both fields empty shows both required errors; submitting an invalid email format shows the email error; submitting a too-short password shows the password error; a fully valid submit shows the stub message and does not navigate
- Manual verification via dev server + browser tool: visit `/login` directly, confirm layout, confirm validation errors appear/clear correctly, confirm valid submit shows the stub message

## Open Questions / Future Phases

- Sign up screen, forgot password screen — separate specs
- Real Supabase Auth wiring (session state, route gating, redirect-after-login)
- Social login (Apple/Google) if desired later
