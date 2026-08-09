-- Recurring items engine: recurring_series holds the recurrence rule.
-- Each generated cycle is its own row in bills/reminders (never mutated
-- once closed) -- history is just "all rows sharing a series_id", so no
-- separate append-only log table is needed.

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
  occurrences_generated integer not null default 1,
  status text not null default 'active' check (status in ('active', 'paused', 'stopped')),
  created_at timestamptz not null default now(),
  check (
    (frequency = 'custom' and custom_interval_unit is not null and custom_interval_count is not null)
    or (frequency != 'custom' and custom_interval_unit is null and custom_interval_count is null)
  )
);

alter table public.recurring_series enable row level security;

create policy "Authenticated users can view recurring series"
  on public.recurring_series for select to authenticated using (true);
create policy "Authenticated users can insert recurring series"
  on public.recurring_series for insert to authenticated with check (true);
create policy "Authenticated users can update recurring series"
  on public.recurring_series for update to authenticated using (true);

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
