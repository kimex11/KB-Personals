-- Credit card dues and income sources: global/shared like categories
-- (single-admin app, not personal-per-user data in the RLS sense).

create table public.credit_card_dues (
  id uuid primary key default gen_random_uuid(),
  card_name text not null,
  last4 text not null,
  statement_balance numeric(12, 2) not null,
  minimum_payment numeric(12, 2) not null,
  due_date date not null,
  created_at timestamptz not null default now()
);

alter table public.credit_card_dues enable row level security;

create policy "Authenticated users can view credit card dues"
  on public.credit_card_dues for select to authenticated using (true);
create policy "Authenticated users can insert credit card dues"
  on public.credit_card_dues for insert to authenticated with check (true);
create policy "Authenticated users can update credit card dues"
  on public.credit_card_dues for update to authenticated using (true);
create policy "Authenticated users can delete credit card dues"
  on public.credit_card_dues for delete to authenticated using (true);

create index credit_card_dues_due_date_idx on public.credit_card_dues(due_date);

create table public.income_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric(12, 2) not null,
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly')),
  next_date date not null,
  created_at timestamptz not null default now()
);

alter table public.income_sources enable row level security;

create policy "Authenticated users can view income sources"
  on public.income_sources for select to authenticated using (true);
create policy "Authenticated users can insert income sources"
  on public.income_sources for insert to authenticated with check (true);
create policy "Authenticated users can update income sources"
  on public.income_sources for update to authenticated using (true);
create policy "Authenticated users can delete income sources"
  on public.income_sources for delete to authenticated using (true);

create index income_sources_next_date_idx on public.income_sources(next_date);

insert into public.credit_card_dues (card_name, last4, statement_balance, minimum_payment, due_date) values
  ('Visa Platinum', '4821', 842.50, 45, current_date - interval '2 days'),
  ('Mastercard Gold', '7734', 315.20, 25, current_date + interval '4 days'),
  ('Amex Everyday', '2290', 128.75, 15, current_date + interval '18 days');

insert into public.income_sources (name, amount, frequency, next_date) values
  ('Salary', 3200, 'biweekly', current_date + interval '5 days'),
  ('Freelance Design Work', 450, 'monthly', current_date + interval '10 days');
