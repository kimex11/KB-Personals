# Activity Log / Audit Trail

Status: Approved (autonomous — user authorized proceeding without an interactive review round; see Autonomous Decisions below)
Date: 2026-08-12

## Problem

The user asked for a dedicated Activity Log / Audit Trail section, captured as a backlog item on 2026-08-07 (queued behind the Tile UI Revamp, which just shipped across 4 phases). Requirements as given then:

- Record all important activities: create, edit, update, delete, upload, link, approve/skip, archive/unarchive, merge.
- Identify who performed each action (account info, recognizable app-wide).
- Capture: activity type, item/particular, previous value, updated value (when applicable), user, date, time.
- Display timestamps in the user's local timezone; store standardized (UTC) timestamps in the DB.
- Searchable/filterable by user, activity type, item/category, date range.
- Clean, professional, scannable, mobile-responsive UI (now: tile-language-consistent, since the revamp landed since this was written).
- Backed by Supabase: proper relationships, indexing, RLS.
- Tamper-resistant: normal users cannot modify or delete historical audit records (append-only).
- Applied consistently across all modules, present and future.

This is a cross-cutting subsystem — one new table plus a write-path convention every mutation in every `lib/*-repository.ts` file calls into — not a single-screen feature. It touches Bills, Reminders, Accounts (credit cards + income), Categories, and Receipts.

## Autonomous Decisions

The user authorized proceeding through this entire feature (brainstorm → spec → plan → execute → QA → push) without an interactive review round, since they went offline for the night ("decide for me if no response within 1 min"). The decisions below are what an interactive round would normally have settled — recorded here for transparency rather than left implicit:

1. **App-level logging, not DB triggers** — refined during Phase 2 to log from the **hook layer** (`lib/use-bills.ts` etc.), not inside `lib/*-repository.ts` functions. The 2026-08-07 backlog note's own framing ("a generic `audit_logs` table + a write-path convention every repository should call into") named the *shape* (app-level, not SQL triggers), but the repository layer turned out to be the wrong altitude for it: repository functions like `updateBill(id, patch)` only ever receive the partial patch, not the row's prior state, so logging there would need an extra `select` before every `update` — which breaks existing repository unit tests that mock the update chain without a preceding select (see `lib/bills-repository.test.ts`'s `updateBill` "throws on error" test), and adds a real round-trip Postgres doesn't need. The hooks (`lib/use-bills.ts`, `lib/use-reminders.ts`, etc.) already hold the full current row in their own state array before calling any repository mutation — `bills.find((b) => b.id === id)` gives the exact "before" snapshot for free, in memory, no extra query. So `logActivity()` calls live in each hook's mutation wrapper, right after its repository call resolves. Trade-off accepted: a mutation made directly via SQL/the Supabase dashboard, or one replayed later from the offline sync queue (`lib/offline/sync-engine.ts`, which calls repository functions directly, not through the hook), bypasses the log — acceptable for a personal-use app where the overwhelming majority of real mutations go through this app's UI while online.
2. **"Who" = the authenticated user's email**, not a separate display-name lookup. `profiles.display_name` exists but is optional and this app has no multi-user "team" concept — email already uniquely and recognizably identifies the actor, and capturing it happens via `supabase.auth.getUser()`, which every authenticated request already has for free (no extra round trip). If the user later wants richer identity (avatar, name), that's a small additive change to `logActivity`, not a redesign.
3. **Before/after values are curated domain snapshots, not raw-row diffs.** E.g. for a bill: `{ title, amount, dueDate, category, paid }`, not the raw `bills` table row (which has FK ids, `created_at`, etc. that aren't meaningful to a human reading the log). This means each hook's call site decides what's worth capturing for that entity — consistent with how this app already hand-writes `rowToBill`/`rowToReminder` mappers rather than working with raw rows everywhere. One further scope-tightening found while implementing Phase 2: a *plain* field edit (e.g. `updateBill(id, { amount: 65 })` from an edit form) logs `beforeValue` from the hook's in-memory row (free, accurate) and `afterValue` as the merged result — full before/after, no gap. Every mutation path ends up with a real "before" because every hook wrapper already has the row in its own state before it calls the repository.
4. **`logActivity` failures never block the mutation they're logging.** Every call site does `logActivity({...}).catch(() => {})` — fire-and-forget. Losing one audit entry to a transient network blip is far less bad than failing the user's actual bill/reminder edit because the *logging* call failed.
5. **Tamper-resistance via RLS, not application logic.** `audit_log` gets `select`/`insert` policies for authenticated users and deliberately *no* `update`/`delete` policy — Postgres RLS defaults to deny, so there is no code path, buggy or malicious, that can alter or remove a row once inserted (short of a service-role/dashboard action, which is outside any RLS model and is the accepted ceiling for "tamper-resistant" in a single-tenant app like this one).
6. **Scope/sequencing**: this is phased like the Tile UI Revamp, because it touches every hook:
   - Phase 1: `audit_log` table + migration, `lib/audit-log-repository.ts` (`logActivity`/`listAuditLog`), and a new `/activity` page (list view, no filters yet) — establishes the convention and gives the user something to look at immediately.
   - Phase 2: wire `logActivity` into `lib/use-bills.ts` (create, update, delete, toggle paid, skip cycle, create recurring).
   - Phase 3: wire into `lib/use-reminders.ts` (create, update, delete, toggle complete, skip cycle, snooze, create recurring).
   - Phase 4: wire into `lib/use-accounts.ts` (card create/update/delete, income create/update/delete).
   - Phase 5: wire into `lib/use-categories.ts` (create, update, archive, unarchive, delete, merge, reorder) and the receipts upload/manage flow (upload, rename, remove, description update, bill link).
   - Phase 6: `/activity` search/filter UI (by actor, activity type, entity type, date range) — deferred until there's real log data across all entities to filter, per the requirements list above.
   - Each phase ships independently: the log works and is useful after Phase 1, gets one more entity's coverage per phase, and Phase 6 is pure UI polish on top of data that already exists by then.

## Architecture

**Schema** (`supabase/migrations/0013_audit_log.sql`):

```sql
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  actor_email text not null,
  action text not null check (action in ('create', 'update', 'delete', 'upload', 'link', 'unlink', 'skip', 'archive', 'unarchive', 'merge')),
  entity_type text not null,
  entity_id uuid,
  entity_label text not null,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

create policy "Authenticated users can view audit log"
  on public.audit_log for select to authenticated using (true);
create policy "Authenticated users can insert audit log entries"
  on public.audit_log for insert to authenticated with check (auth.uid() = actor_id);

create index audit_log_created_at_idx on public.audit_log(created_at desc);
create index audit_log_entity_type_idx on public.audit_log(entity_type);
create index audit_log_actor_id_idx on public.audit_log(actor_id);
```

No `update`/`delete` policy is created deliberately — RLS defaults to deny, making the table append-only for every authenticated client.

**Write path** (`lib/audit-log-repository.ts`):

```
logActivity(input: {
  action: AuditAction;
  entityType: string;       // 'bill' | 'reminder' | 'credit_card_due' | 'income_source' | 'category' | 'receipt'
  entityId: string | null;
  entityLabel: string;      // human-readable snapshot, e.g. "Internet Bill" -- survives entity deletion
  beforeValue?: Record<string, unknown> | null;
  afterValue?: Record<string, unknown> | null;
}): Promise<void>
```

Reads the current user via `supabase.auth.getUser()`, inserts one `audit_log` row. Per Autonomous Decision #1, every call site is in a **hook** (`lib/use-bills.ts`, `lib/use-reminders.ts`, `lib/use-accounts.ts`, `lib/use-categories.ts`, and the receipts page's upload/manage handlers), right after that hook's own repository call resolves, using the hook's already-in-memory row for the "before" snapshot and `.catch(() => {})` so a logging failure never blocks the real mutation.

**Read path**: `listAuditLog(filters?)` — `filters` is unused (returns everything, newest first) until Phase 6 adds actor/action/entityType/date-range parameters.

**UI**: `/activity` page — a new top-level route, added to the shell's navigation. List view of `ActivityLogEntry` tiles (single-column, chunkier tile like Budget/Categories from the tile revamp, not grid-ed — an audit trail reads top-to-bottom chronologically, a 2-column grid would break that order). Each entry shows: action + entity type icon/color, entity label, actor email, relative + absolute timestamp (local time, per the requirement), and an expandable before/after diff when both are present.

## Testing

- `lib/audit-log-repository.test.ts`: `logActivity` inserts the right row shape; `listAuditLog` returns rows ordered newest-first. Supabase client mocked the same way every other repository test in this codebase already mocks it.
- Each hook's existing test file gets a mock for `logActivity` plus new assertions once that hook is wired in its phase (e.g. `use-bills.test.ts` gets a test that `createBill()` also calls `logActivity` with the right snapshot) — no existing test's assertions change, since `logActivity` is additive and repository call signatures are untouched.
- `/activity` page gets a `page.test.tsx` following this app's established page-test conventions (mock the repository, render, assert list content).

## Out of scope

- Retroactive backfill of history for mutations made before this feature existed — starts logging from when Phase 2+ lands for each entity, per the 2026-08-07 note's own framing ("log only from now on vs. backfill" was flagged as a decision point; backfill is impossible anyway since no historical before/after data was ever captured).
- Multi-tenant/team identity (avatars, roles, permissions beyond the existing single `authenticated` role) — this app has one shared authenticated user base, not an organization model.
- Logging mutations replayed from the offline sync queue (`lib/offline/sync-engine.ts` calls repository functions directly, bypassing the hooks) — a mutation made while offline is logged once it's replayed only if the user is still on the page with the hook mounted when `processQueue` runs; a queued mutation that syncs in the background on a later app open is a known gap, not solved by this feature.
- Reverting/restoring a past state from an audit entry ("undo") — this is a read-only trail, not a version-control system.
