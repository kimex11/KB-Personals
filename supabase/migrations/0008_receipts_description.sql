-- Lets a receipt carry a user-editable free-text description alongside the
-- OCR-extracted fields. Nullable, no default — most receipts won't have one.
alter table public.receipts add column description text;
