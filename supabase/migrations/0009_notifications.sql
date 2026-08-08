-- Notification delivery infrastructure: push subscriptions (one row per
-- subscribed browser/device), a dedupe log (so the sweep never re-sends the
-- same state twice), and per-user preferences (quiet hours, sound, which
-- priorities are enabled). Unlike bills/reminders/categories, these ARE
-- scoped to auth.uid() -- a push subscription and quiet-hours preference
-- are inherently per-device/per-person even in this single-admin app.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "Users can view own push subscriptions"
  on public.push_subscriptions for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own push subscriptions"
  on public.push_subscriptions for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can delete own push subscriptions"
  on public.push_subscriptions for delete to authenticated using (auth.uid() = user_id);

create index push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('bill', 'reminder')),
  entity_id uuid not null,
  priority text not null check (priority in ('critical', 'urgent', 'reminder')),
  state_key text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, entity_type, entity_id, state_key)
);

alter table public.notification_log enable row level security;

-- Read-only for clients: the in-app fallback checks this table so it
-- doesn't double-notify for something the server already pushed. Writes
-- only ever come from the Edge Function via the service-role key, which
-- bypasses RLS entirely -- there is deliberately no insert/update/delete
-- policy for `authenticated` here.
create policy "Users can view own notification log"
  on public.notification_log for select to authenticated using (auth.uid() = user_id);

create index notification_log_user_id_idx on public.notification_log(user_id);

create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  quiet_hours_start time,
  quiet_hours_end time,
  sound_enabled boolean not null default true,
  enabled_priorities text[] not null default array['critical', 'urgent', 'reminder'],
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy "Users can view own notification preferences"
  on public.notification_preferences for select to authenticated using (auth.uid() = user_id);
create policy "Users can upsert own notification preferences"
  on public.notification_preferences for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own notification preferences"
  on public.notification_preferences for update to authenticated using (auth.uid() = user_id);
