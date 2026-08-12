alter table public.credit_card_dues
  add column if not exists balance_anchor_at timestamptz not null default now();

create policy "Authenticated users can update credit card payments"
  on public.credit_card_payments for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete credit card payments"
  on public.credit_card_payments for delete to authenticated using (true);

create policy "Authenticated users can update payment plan payments"
  on public.payment_plan_payments for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete payment plan payments"
  on public.payment_plan_payments for delete to authenticated using (true);
