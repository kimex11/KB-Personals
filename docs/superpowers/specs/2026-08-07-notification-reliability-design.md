# Notification System Reliability & Optimization

Status: Approved (pending spec review)
Date: 2026-08-07

## Problem

The current notification system (`lib/notifications.ts`, `lib/notification-sound.ts`,
`lib/use-overdue-alerts.ts`) only fires while the app tab is open in the foreground —
it calls the plain `Notification` constructor from client JS on a polling effect. There is
no service-worker push handling (`public/sw.js` has no `push` or `notificationclick`
listeners), no server-side scheduling, no push subscription storage, and no way to reach
the user when the phone is locked, the browser is backgrounded, or the PWA is fully closed.
There is also no notification priority model, no deep-linking from a notification tap to
the underlying record, and no dedupe beyond a client-side localStorage set of already-seen
alert IDs (which does not survive across devices or a cleared cache).

Goal: reliable delivery of bill/reminder alerts via real Web Push, with priority
tiers, dedupe, grouping, deep links, and a graceful in-app fallback — without mock data or
placeholder wiring.

## Architecture

**Budget-threshold trigger dropped from this project.** `lib/budget-data.ts` is
hardcoded mock spend/limit data, not a real DB table wired to actual bills/receipts —
there is no `budgets` table. A notification computed from those numbers would be a real
push firing on fake data, which fails the "no mock/placeholder" bar. This becomes a
follow-up project once the budget subsystem itself has a real backing table; it is a
pre-existing gap unrelated to notification delivery. This plan ships `critical` (bill
overdue), `urgent` (bill due soon), and `reminder` (user reminders) — all backed by real
tables already.

Both `bills.due_date` and `reminders.due_date` are DATE columns (no time-of-day
component in the schema), so there is no benefit to a tight polling interval — a single
schedule is enough.

```
pg_cron (Postgres, one schedule: every 15 minutes)
        │
        ▼
Supabase Edge Function `notify-sweep`
  1. Query due-worthy state:
     - bills: overdue (due_date < current_date, paid = false) → priority "critical"
     - bills: due_date = current_date OR due_date within N days out
       (paid = false) → priority "urgent"
     - reminders: due_date <= current_date, completed = false → priority "reminder"
     Bills/reminders/categories are global shared data in this app (RLS gates on
     `authenticated`, not per-row ownership — see migrations 0004/0006/0007), so a
     due-worthy item is not "owned" by one user. The sweep fans each due-worthy item
     out to every row in `push_subscriptions` (i.e. every authenticated device that
     has opted in), not just one.
  2. Dedupe per (subscription's user_id, entity_type, entity_id, state_key) against
     `notification_log`. Only inserts + sends when the state_key is new for that
     user+entity pair (e.g. a bill moving from "due_today" to "overdue" is a new
     state_key, so it re-notifies once; it never re-notifies for the same state_key
     twice for the same user).
  3. Apply quiet hours from `notification_preferences` (per user_id): critical/urgent
     bypass quiet hours; reminder is skipped (not queued/retried — the next sweep after
     the window naturally picks up anything still in a due-worthy state).
  4. Group same-priority items produced in the same sweep run into one Web Push message
     per priority tier per user, using the payload's `tag` field so the OS collapses
     them into a single notification. Single-item groups keep full detail (title,
     amount, due date). Multi-item groups summarize ("3 bills overdue: $420 total") and
     deep-link to the relevant list view instead of one record.
  5. Send via `web-push` (VAPID keys) to every `push_subscriptions` row for that user.
     On a 404/410 response from the push service, delete that subscription row (device
     unsubscribed or push service revoked it) — the row is deleted before deciding
     whether to log the send as sent, so retries don't loop.
        │
        ▼
public/sw.js
  `push` event      → parse JSON payload → self.registration.showNotification with
                       icon, badge, vibrate pattern per priority, tag (for grouping),
                       requireInteraction (critical only), data.url (deep link target)
  `notificationclick` event → close notification, focus an existing client on
                       data.url if one is open, else self.clients.openWindow(data.url)
```

## Data Model

New migration `supabase/migrations/0009_notifications.sql`:

- `push_subscriptions`
  `id uuid pk, user_id uuid fk profiles, endpoint text unique, p256dh text, auth text,
  user_agent text, created_at timestamptz` — one row per subscribed browser/device per
  user. RLS: user can only see/insert/delete their own rows.

- `notification_log`
  `id uuid pk, user_id uuid fk profiles, entity_type text, entity_id uuid, priority text,
  state_key text, sent_at timestamptz` — unique constraint on
  `(user_id, entity_type, entity_id, state_key)` enforces the dedupe at the DB level, not
  just in application logic. RLS: user can only see their own rows; writes come only from
  the Edge Function (service role).

- `notification_preferences`
  `user_id uuid pk fk profiles, quiet_hours_start time, quiet_hours_end time,
  sound_enabled boolean default true, enabled_priorities text[] default all three` — one
  row per user, upserted from the settings UI.

## Priority Model

Shared TypeScript enum (`lib/notification-priority.ts`), imported by both client code and
the Edge Function (via a duplicated constant, since Edge Functions run in Deno and cannot
import from `lib/` directly — see Open Questions):

| Priority | Trigger | Vibration | requireInteraction | Quiet hours |
|---|---|---|---|---|
| `critical` | Bill overdue | long-short-long pattern | true | bypasses |
| `urgent` | Bill due today / within window | double-pulse | false | bypasses |
| `reminder` | User reminder due | single pulse | false | respects |

Sound: the Web Push / Notification API gives no cross-browser way to set a custom sound
file for an OS-delivered background/locked notification — Chrome, Safari, and Firefox all
play the platform default sound in that case. The existing `playNotificationSound()`
AudioContext chime remains as-is and continues to fire only for the **foreground** path
(tab open). Background/locked notifications rely on the OS default sound plus the
priority-specific vibration pattern above as the differentiator.

## Client Changes

- `public/sw.js` — add `push` and `notificationclick` listeners as described above. Keep
  the existing cache-only `install`/`activate`/`fetch` behavior untouched.
- `lib/push-subscription.ts` (new) — `subscribeToPush()` / `unsubscribeFromPush()`:
  wraps `PushManager.subscribe`/`.unsubscribe`, upserts/deletes the corresponding
  `push_subscriptions` row via the Supabase client.
- `components/dashboard/NotificationSettings.tsx` — extend to:
  - distinguish `unsupported` (no `Notification`/`PushManager`/`serviceWorker` in
    `window`/`navigator`) from `default`/`denied`/`granted`, with distinct copy for each
  - show explicit re-enable instructions when `denied` (browser blocks re-prompting)
  - add quiet-hours start/end inputs and per-priority enable toggles, backed by
    `notification_preferences`
- `lib/notifications.ts` / `lib/use-overdue-alerts.ts` — kept as the **in-app fallback**:
  when a push subscription doesn't exist (permission `denied`/`unsupported`, or the
  subscribe call failed) or the tab is already open and foregrounded, local
  polling + `showNotification` + chime + vibrate still fire. Fallback reads the same
  `notification_log` state keys (fetched client-side) so it never double-fires against
  an item the sweep already pushed.
- `app/(shell)/bills/page.tsx`, `app/(shell)/reminders/page.tsx` — read a
  `?open=<id>` search param on mount and auto-open the matching item's edit modal. This
  is the deep-link landing behavior for a notification tap.

## Server Changes

- `supabase/functions/notify-sweep/index.ts` (new Edge Function) — the sweep logic
  described in Architecture. Uses the `web-push` npm-compatible Deno import, service-role
  Supabase client, and reads VAPID keys from Edge Function secrets
  (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).
- `supabase/migrations/0009_notifications.sql` — schema above, plus the two `pg_cron`
  schedules (`cron.schedule(...)` calling the Edge Function via `net.http_post`, gated on
  the `pg_net` extension being enabled).

## Testing

Automated (vitest, following existing repo patterns):
- `notification-priority` mapping (pure function: entity state → priority + state_key)
- dedupe logic (given existing `notification_log` rows, which entities are eligible)
- quiet-hours gating (critical/urgent bypass; reminder respected)
- grouping/tag logic (single item vs multi-item summary payload)
- `sw.js` `push` / `notificationclick` handlers (jsdom + mocked
  `ServiceWorkerGlobalScope`/`registration.showNotification`/`clients`)
- `?open=` param handling on Bills/Reminders pages
- `NotificationSettings` new states (`unsupported`, `denied` messaging, quiet-hours form)

Manual device matrix (executed before this is considered done, not a "nice to have"):
- iOS Safari, installed to home screen (PWA, iOS 16.4+) — locked screen, backgrounded,
  fully closed
- Android Chrome, installed PWA — locked screen, backgrounded, fully closed
- Desktop Chrome/Edge — backgrounded browser, closed browser
- Permission `denied` → in-app fallback path confirmed working
- Offline/airplane-mode at delivery time → confirm no crash, confirm eventual delivery
  or graceful drop is understood or covered by fallback

## Open Questions / Risks

- **Deno import boundary**: the Edge Function runs on Deno and cannot import
  `lib/notification-priority.ts` directly from the Next.js app. The priority-mapping
  constants will be duplicated between `lib/notification-priority.ts` (client) and
  `supabase/functions/notify-sweep/priority.ts` (server), kept in sync by a unit test
  that asserts both modules produce identical output for the same fixture inputs.
- **pg_cron / pg_net availability**: this project's Supabase instance
  (`qxkgjxxuoxczyuvhcbal`) is not reachable through the connected Supabase MCP tools in
  this session (only `SAH Tracker` and `PickleCDO` projects are visible there). Enabling
  the `pg_cron` and `pg_net` extensions, setting Edge Function secrets, and deploying the
  function will need to go through the Supabase CLI or dashboard with the user's
  credentials rather than the MCP tools.
- **Single-owner assumption**: this app has one user per Supabase profile, not
  multi-tenant org sharing — notifications are scoped per `user_id` with no additional
  routing logic. Flag if that assumption is wrong.
