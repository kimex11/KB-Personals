-- Bills: global/shared like categories/accounts. category_id is a real FK
-- now that public.categories exists (previously bills only existed as mock
-- data with ids like "bill-0", which is why receipts.linked_bill_id was
-- widened to text in migration 0003 -- tightened back to uuid below).

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category_id uuid not null references public.categories(id),
  amount numeric(12, 2) not null,
  due_date date not null,
  recurrence text check (recurrence in ('weekly', 'monthly', 'quarterly', 'yearly')),
  paid boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.bills enable row level security;

create policy "Authenticated users can view bills"
  on public.bills for select to authenticated using (true);
create policy "Authenticated users can insert bills"
  on public.bills for insert to authenticated with check (true);
create policy "Authenticated users can update bills"
  on public.bills for update to authenticated using (true);
create policy "Authenticated users can delete bills"
  on public.bills for delete to authenticated using (true);

create index bills_due_date_idx on public.bills(due_date);
create index bills_category_id_idx on public.bills(category_id);

insert into public.bills (title, category_id, amount, due_date, recurrence, paid)
select 'Rent', id, 1450, current_date - interval '20 days', 'monthly', true from public.categories where name = 'Housing'
union all
select 'Internet Bill', id, 59.99, current_date - interval '10 days', 'monthly', true from public.categories where name = 'Utilities'
union all
select 'Credit Card Payment', id, 320.15, current_date - interval '3 days', null, false from public.categories where name = 'Shopping'
union all
select 'Electricity Bill', id, 84.5, current_date, 'monthly', false from public.categories where name = 'Utilities'
union all
select 'Netflix', id, 15.99, current_date + interval '1 day', 'monthly', false from public.categories where name = 'Entertainment'
union all
select 'Car Insurance', id, 145, current_date + interval '2 days', 'quarterly', false from public.categories where name = 'Transport'
union all
select 'Phone Plan', id, 45, current_date + interval '6 days', 'monthly', false from public.categories where name = 'Utilities'
union all
select 'Gym Membership', id, 29.99, current_date + interval '15 days', 'monthly', false from public.categories where name = 'Entertainment'
union all
select 'Annual Domain Renewal', id, 18, current_date + interval '25 days', 'yearly', false from public.categories where name = 'Shopping';

-- Tighten receipts.linked_bill_id back to a real FK now that bills exists.
-- Null out any stale mock-era links first (values like "bill-0" that were
-- never valid uuids and no longer correspond to anything).
update public.receipts
set linked_bill_id = null
where linked_bill_id is not null
  and linked_bill_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

alter table public.receipts
  alter column linked_bill_id type uuid using linked_bill_id::uuid;

alter table public.receipts
  add constraint receipts_linked_bill_id_fkey foreign key (linked_bill_id) references public.bills(id) on delete set null;
