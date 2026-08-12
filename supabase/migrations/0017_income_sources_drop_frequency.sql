alter table public.income_sources drop column if exists frequency;
alter table public.income_sources rename column next_date to date;
