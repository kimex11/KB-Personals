alter table public.credit_card_dues
  add column if not exists image_storage_path text;

-- Card artwork is cosmetic, not sensitive like receipts, so the bucket is
-- public: thumbnails render straight from a public URL with no per-row
-- signed-URL round trip needed to list cards.
insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload card images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'card-images');

create policy "Anyone can view card images"
  on storage.objects for select
  using (bucket_id = 'card-images');

create policy "Authenticated users can delete card images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'card-images');
