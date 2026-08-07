-- Receipt storage: a private bucket for uploaded receipt files, plus a
-- metadata table so receipts can be listed, cross-referenced with bills,
-- and carry OCR-extracted fields. RLS on both scopes everything to the
-- owning user via auth.uid().

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  file_size integer not null,
  storage_path text not null,
  merchant text,
  receipt_date date,
  amount numeric(12, 2),
  linked_bill_id uuid,
  created_at timestamptz not null default now()
);

alter table public.receipts enable row level security;

create policy "Users can view own receipts"
  on public.receipts for select using (auth.uid() = user_id);

create policy "Users can insert own receipts"
  on public.receipts for insert with check (auth.uid() = user_id);

create policy "Users can update own receipts"
  on public.receipts for update using (auth.uid() = user_id);

create policy "Users can delete own receipts"
  on public.receipts for delete using (auth.uid() = user_id);

create index receipts_user_id_idx on public.receipts(user_id);
create index receipts_linked_bill_id_idx on public.receipts(linked_bill_id);

-- Storage bucket. Files are expected to live under `{user_id}/{filename}` so
-- the RLS policies below (matching on the first path segment) can enforce
-- per-user access without needing a separate lookup.
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "Users can upload own receipt files"
  on storage.objects for insert
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can view own receipt files"
  on storage.objects for select
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete own receipt files"
  on storage.objects for delete
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
