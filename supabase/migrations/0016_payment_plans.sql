create table public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid not null references public.categories(id),
  total_amount numeric(12, 2) not null check (total_amount > 0),
  installment_count int not null check (installment_count > 0),
  monthly_amount numeric(12, 2) not null check (monthly_amount > 0),
  start_date date not null,
  created_at timestamptz not null default now()
);

alter table public.payment_plans enable row level security;

create policy "Authenticated users can view payment plans"
  on public.payment_plans for select to authenticated using (true);
create policy "Authenticated users can insert payment plans"
  on public.payment_plans for insert to authenticated with check (true);
create policy "Authenticated users can update payment plans"
  on public.payment_plans for update to authenticated using (true);
create policy "Authenticated users can delete payment plans"
  on public.payment_plans for delete to authenticated using (true);

create index payment_plans_category_id_idx on public.payment_plans(category_id);

create table public.payment_plan_payments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.payment_plans(id) on delete cascade,
  installment_number int not null check (installment_number > 0),
  amount numeric(12, 2) not null check (amount > 0),
  balance_before numeric(12, 2) not null,
  balance_after numeric(12, 2) not null,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.payment_plan_payments enable row level security;

create policy "Authenticated users can view payment plan payments"
  on public.payment_plan_payments for select to authenticated using (true);
create policy "Authenticated users can insert payment plan payments"
  on public.payment_plan_payments for insert to authenticated with check (true);

create index payment_plan_payments_plan_id_idx on public.payment_plan_payments(plan_id);
create index payment_plan_payments_paid_at_idx on public.payment_plan_payments(paid_at desc);
