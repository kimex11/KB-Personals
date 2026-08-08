# Recurring Items Engine (Phase 1 of Recurring Bills & Smart Due-Date Countdown)

Status: Approved (pending spec review)
Date: 2026-08-08

## Problem

`bills.recurrence` is currently a label-only field (`'weekly'|'monthly'|'quarterly'|'yearly'|null`)
with no generative behavior — marking a bill paid does nothing to create its next
occurrence, there is no history of past cycles beyond whatever the single row's fields
currently hold, and reminders have no recurrence concept at all. The user wants full
recurring-item support (bills, subscriptions, loans, installments, utilities,
memberships, and recurring reminders) with configurable frequencies including a custom
interval, automatic next-due-date generation, full cycle history (previous due dates,
payment dates, amount changes, skipped cycles), skip/pause/stop controls, auto-renew vs
fixed end date/occurrence count, and duplicate-safe, timezone-safe, month-end-safe date
math.

This is Phase 1 of a four-phase project (recurrence engine → countdown UI → filters/
summary insights → configurable reminder-schedule integration with the push notification
system built previously). This spec covers Phase 1 only: the data model and generation
logic that every later phase reads from. It intentionally does not cover UI — no
countdown badge, no urgency colors, no filters, no summary tiles. Those are Phase 2/3
and get their own specs once this foundation is in place.

## Architecture

Each recurring cycle is a real row in `bills` or `reminders`, not a single row that
mutates in place. A new `recurring_series` table holds the rule (frequency, custom
interval, amount mode, auto-renew/end conditions, active/paused/stopped status). Bills
and reminders gain a `series_id` FK, a `cycle_number`, and a `skipped` flag. Paying or
completing a row with a `series_id` closes that row permanently (it becomes history) and
inserts a new row for the next cycle. History is simply "all rows sharing a `series_id`,"
queryable directly — no separate append-only log table is needed, since the closed rows
themselves ARE the log.

```
User marks bill/reminder paid or completed
        │
        ▼
generateNextOccurrence(closedRow, series)
  1. If series.status !== 'active' → do nothing (paused/stopped series don't advance)
  2. Compute nextDueDate = addInterval(closedRow.dueDate, series.frequency, series.customIntervalUnit, series.customIntervalCount)
  3. If series.autoRenew === false:
       - if series.endDate is set and nextDueDate > series.endDate → stop (series.status = 'stopped'), do not insert
       - if series.maxOccurrences is set and series.occurrencesGenerated >= series.maxOccurrences → stop, do not insert
  4. Insert new row: series_id, cycle_number = closedRow.cycleNumber + 1, due_date = nextDueDate,
     paid/completed = false, skipped = false, amount = resolved per series.amountMode
     (bills only — reminders have no amount)
  5. Increment series.occurrencesGenerated
  6. Unique constraint on (series_id, cycle_number) makes step 4 idempotent against
     double-submission (e.g. a double-click on "mark paid")
```

Skipping a cycle (user explicitly skips without paying) runs the same generation logic
as paying, except the closed row is marked `skipped = true` instead of `paid = true`, and
no payment date is recorded. This keeps skipped cycles distinguishable from paid ones in
history queries.

## Data Model

New migration `supabase/migrations/0011_recurring_series.sql`:

```sql
create table public.recurring_series (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('bill', 'reminder')),
  frequency text not null check (frequency in
    ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semi_annual', 'annual', 'custom')),
  custom_interval_unit text check (custom_interval_unit in ('day', 'week', 'month')),
  custom_interval_count integer check (custom_interval_count > 0),
  amount_mode text not null default 'fixed' check (amount_mode in ('fixed', 'editable')),
  auto_renew boolean not null default true,
  end_date date,
  max_occurrences integer check (max_occurrences > 0),
  occurrences_generated integer not null default 1, -- the row that created the series counts as occurrence 1
  status text not null default 'active' check (status in ('active', 'paused', 'stopped')),
  created_at timestamptz not null default now(),
  check (
    (frequency = 'custom' and custom_interval_unit is not null and custom_interval_count is not null)
    or (frequency != 'custom' and custom_interval_unit is null and custom_interval_count is null)
  )
);
```

`bills` and `reminders` each gain:

```sql
alter table public.bills
  add column series_id uuid references public.recurring_series(id) on delete set null,
  add column cycle_number integer,
  add column skipped boolean not null default false;

alter table public.reminders
  add column series_id uuid references public.recurring_series(id) on delete set null,
  add column cycle_number integer,
  add column skipped boolean not null default false;

create unique index bills_series_cycle_unique_idx on public.bills(series_id, cycle_number) where series_id is not null;
create unique index reminders_series_cycle_unique_idx on public.reminders(series_id, cycle_number) where series_id is not null;
```

(RLS: `recurring_series` follows the same `authenticated`-gated policy pattern as
`bills`/`reminders`/`categories` — this app treats series rules as shared/global data
too, consistent with the existing schema convention noted in migrations 0004/0006/0007.)

## Date Math

`addInterval(dueDate: string, frequency, customUnit?, customCount?): string` is a pure
function built on `date-fns`'s `addDays`/`addWeeks`/`addMonths`:

| Frequency | Implementation |
|---|---|
| `daily` | `addDays(date, 1)` |
| `weekly` | `addDays(date, 7)` |
| `biweekly` | `addDays(date, 14)` |
| `monthly` | `addMonths(date, 1)` |
| `quarterly` | `addMonths(date, 3)` |
| `semi_annual` | `addMonths(date, 6)` |
| `annual` | `addMonths(date, 12)` |
| `custom` | `addDays`/`addWeeks`/`addMonths(date, customCount)` per `customIntervalUnit` |

`date-fns`'s `addMonths` already clamps day-of-month overflow to the target month's last
valid day (e.g. Jan 31 + 1 month → Feb 28, or Feb 29 in a leap year) — this is what makes
month-end handling (29th/30th/31st, February, leap years) correct without hand-rolled
calendar math. All date arithmetic operates on the ISO date string's calendar date only
(no time-of-day, no timezone conversion), matching how `bills.due_date`/`reminders.due_date`
are already stored as DATE columns — this sidesteps timezone bugs entirely rather than
trying to solve them, since there is no time component to get wrong.

## Repository & UI Wiring (minimum viable for this phase)

- `lib/recurring-series-types.ts` — `RecurringSeries`, `Frequency`, `AmountMode` types.
- `lib/recurring-series-repository.ts` — `createSeries`, `getSeries`, `updateSeries`
  (pause/resume/stop/edit rule), following the existing repository pattern (manual row
  interfaces, `as RowType` casts — see `lib/reminders-repository.ts`).
- `lib/recurring-date-math.ts` — the pure `addInterval` function above, fully unit
  tested including month-end/leap-year fixtures.
- `lib/recurring-generation.ts` — pure `computeNextOccurrence(closedRow, series): NewRowInput | null`
  encoding the generation algorithm above (steps 2-6, minus the DB insert itself, which
  the repository layer performs). Kept pure and separately tested so the
  stop/pause/auto-renew/max-occurrences branching is verifiable without a database.
- `BillForm`/`ReminderForm` gain a One-Time/Recurring toggle. Choosing Recurring reveals
  frequency (+ custom unit/count when `frequency='custom'`), amount mode (bills only),
  auto-renew toggle, and end date / max occurrences inputs (shown only when auto-renew is
  off). On submit, this calls `createSeries` then creates the first bill/reminder row
  with `series_id` set and `cycle_number = 1`.
- `togglePaid` (bills) / `toggleComplete` (reminders) — after marking the row's own
  paid/completed flag, if the row has a `series_id`, call `computeNextOccurrence` and, if
  it returns a row, insert it and increment the series' `occurrences_generated`.
- A "Skip this cycle" action (menu item alongside existing Edit/Delete) on rows with a
  `series_id` and not yet paid/completed — sets `skipped = true` and runs the same
  next-occurrence generation as paying.
- Series-level controls (pause/resume/stop, edit the rule) live wherever the row's
  existing actions menu is — a "Manage series" entry opens a small panel to change
  frequency/amount mode/auto-renew/end conditions or pause/stop. Editing the rule never
  touches already-closed rows.

Explicitly NOT in this phase: any countdown badge/progress ring/urgency color (Phase 2),
filters or summary tiles (Phase 3), configurable N-days-before reminder schedules tied
into the push notification sweep (Phase 4 — the existing `notify-sweep` Edge Function's
3-day "due soon" window is untouched here).

## Testing

- `lib/recurring-date-math.test.ts` — every frequency, plus explicit month-end fixtures:
  Jan 31 monthly → Feb 28 (non-leap) and Feb 29 (leap year); Jan 31 → Apr 30 quarterly;
  custom "every 10 days", "every 6 weeks", "every 2 months" from a 31st.
- `lib/recurring-generation.test.ts` — active series generates the next row; paused
  series generates nothing; auto_renew=false stops exactly at end_date/max_occurrences;
  skip produces a row with `skipped=true` and still advances the cycle; idempotency
  (calling twice for the same closed row's cycle_number does not produce two next-cycle
  rows — enforced at the DB unique-index level, verified here at the pure-function level
  by asserting the same `cycle_number` is always computed for the same input).
- `lib/recurring-series-repository.test.ts` — CRUD + pause/resume/stop, following the
  existing repository test pattern (mocked Supabase client).
- Form/hook integration tests updated wherever `BillForm`/`ReminderForm`/`togglePaid`/
  `toggleComplete` are touched, following each file's existing test conventions.

## Open Questions / Risks

- **Reminders have no `amount` field** — `amount_mode` on `recurring_series` is
  meaningless for `entity_type='reminder'` series; the column stays nullable-in-spirit
  (defaults to `'fixed'` but is simply never read for reminder series). Not worth a
  separate schema per entity type for one unused field.
- **This app's tables are global/shared, not per-user** (see migrations 0004/0006/0007's
  `authenticated`-gated RLS) — `recurring_series` follows the same convention. If a
  future multi-tenant requirement changes that assumption for bills/reminders, this
  table would need to change alongside them, not independently.
- **Supabase access**: same constraint as the notification project — this session's
  Supabase MCP/CLI access does not reach this app's project (`qxkgjxxuoxczyuvhcbal`).
  Migration application is a manual step for the user, as it was for `0009`/`0010`.
