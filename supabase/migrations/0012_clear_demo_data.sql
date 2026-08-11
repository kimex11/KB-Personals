-- Clears the demo/seed rows inserted by earlier migrations (0005_accounts,
-- 0006_bills, 0007_reminders) now that the app is going live with real
-- personal data. Categories are intentionally left alone -- they're a
-- reusable taxonomy (Housing, Groceries, etc.), not financial records, and
-- stay as the starting set the user builds on.
--
-- recurring_series rows are also cleared: the demo bills/reminders never
-- had any (recurring items didn't exist yet when they were seeded), but
-- this keeps the table consistent in case any were created against the
-- demo rows during testing.

delete from public.bills;
delete from public.reminders;
delete from public.credit_card_dues;
delete from public.income_sources;
delete from public.recurring_series;
