-- Bills aren't a real Supabase table yet (still mock data with ids like
-- "bill-0"), so linked_bill_id can't be a uuid until a real bills table
-- exists. Widen it to text so receipts can reference the current mock ids;
-- this can be tightened back to `uuid references public.bills(id)` once
-- bills gets a real table.
alter table public.receipts alter column linked_bill_id type text;
