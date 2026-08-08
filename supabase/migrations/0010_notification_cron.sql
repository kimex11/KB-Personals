-- Schedules the notify-sweep Edge Function every 15 minutes. Both
-- bills.due_date and reminders.due_date are DATE columns with no
-- time-of-day precision, so a single 15-minute cadence is sufficient for
-- both -- see the design spec's Architecture section for why a tighter,
-- separate reminder schedule isn't needed.
--
-- The function call authenticates with a bearer key pulled from Supabase
-- Vault by name ('notify_sweep_key') rather than a literal value, so no
-- secret is ever committed to this file. That secret must be created once,
-- manually, after this migration runs -- see the plan's Task 11 Step 2.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'notify-sweep-every-15-min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://qxkgjxxuoxczyuvhcbal.supabase.co/functions/v1/notify-sweep',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'notify_sweep_key'),
      'Content-Type', 'application/json'
    )
  );
  $$
);
