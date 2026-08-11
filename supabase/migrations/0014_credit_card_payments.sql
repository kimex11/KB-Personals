create table public.credit_card_payments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.credit_card_dues(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  balance_before numeric(12, 2) not null,
  balance_after numeric(12, 2) not null,
  paid_at timestamptz not null default now(),
  method text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.credit_card_payments enable row level security;

create policy "Authenticated users can view credit card payments"
  on public.credit_card_payments for select to authenticated using (true);
create policy "Authenticated users can insert credit card payments"
  on public.credit_card_payments for insert to authenticated with check (true);

create index credit_card_payments_card_id_idx on public.credit_card_payments(card_id);
create index credit_card_payments_paid_at_idx on public.credit_card_payments(paid_at desc);
