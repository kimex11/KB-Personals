-- Reminders: global/shared like bills/categories/accounts. category here is
-- free text (Finance/Personal/Home/Health) -- a different taxonomy from the
-- Budget/Bills categories table, so it is NOT an FK into public.categories.

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  due_date date not null,
  priority text not null check (priority in ('high', 'medium', 'low')),
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.reminders enable row level security;

create policy "Authenticated users can view reminders"
  on public.reminders for select to authenticated using (true);
create policy "Authenticated users can insert reminders"
  on public.reminders for insert to authenticated with check (true);
create policy "Authenticated users can update reminders"
  on public.reminders for update to authenticated using (true);
create policy "Authenticated users can delete reminders"
  on public.reminders for delete to authenticated using (true);

create index reminders_due_date_idx on public.reminders(due_date);

insert into public.reminders (title, category, due_date, priority, completed) values
  ('Renew car insurance', 'Finance', current_date - interval '4 days', 'high', true),
  ('Call insurance provider', 'Finance', current_date - interval '1 day', 'high', false),
  ('Mom''s birthday', 'Personal', current_date, 'medium', false),
  ('Renew passport', 'Personal', current_date + interval '1 day', 'high', false),
  ('Water plants', 'Home', current_date + interval '3 days', 'low', false),
  ('Schedule dentist appointment', 'Health', current_date + interval '5 days', 'medium', false),
  ('Review monthly budget', 'Finance', current_date + interval '8 days', 'medium', false),
  ('Change air filter', 'Home', current_date + interval '12 days', 'low', false);
