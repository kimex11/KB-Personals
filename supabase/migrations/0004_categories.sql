-- Categories: a global, shared classification used by Budget and (soon)
-- Bills. Not per-user like receipts -- this is a single-admin app and
-- categories aren't personal data, so RLS just gates on `authenticated`.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text not null,
  color_slot integer not null check (color_slot between 1 and 12),
  sort_order integer not null,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy "Authenticated users can view categories"
  on public.categories for select to authenticated using (true);
create policy "Authenticated users can insert categories"
  on public.categories for insert to authenticated with check (true);
create policy "Authenticated users can update categories"
  on public.categories for update to authenticated using (true);
create policy "Authenticated users can delete categories"
  on public.categories for delete to authenticated using (true);

create index categories_sort_order_idx on public.categories(sort_order);

insert into public.categories (name, icon, color_slot, sort_order) values
  ('Housing', 'building-2', 1, 0),
  ('Groceries', 'shopping-cart', 2, 1),
  ('Transport', 'car', 3, 2),
  ('Entertainment', 'film', 4, 3),
  ('Utilities', 'zap', 5, 4),
  ('Shopping', 'shopping-bag', 6, 5);
