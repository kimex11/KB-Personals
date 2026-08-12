create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id),
  amount numeric(12, 2) not null check (amount > 0),
  expense_date date not null,
  description text,
  payment_method text,
  created_at timestamptz not null default now()
);

alter table public.expenses enable row level security;

create policy "Authenticated users can view expenses"
  on public.expenses for select to authenticated using (true);
create policy "Authenticated users can insert expenses"
  on public.expenses for insert to authenticated with check (true);
create policy "Authenticated users can update expenses"
  on public.expenses for update to authenticated using (true);
create policy "Authenticated users can delete expenses"
  on public.expenses for delete to authenticated using (true);

create index expenses_expense_date_idx on public.expenses(expense_date desc);
create index expenses_category_id_idx on public.expenses(category_id);
