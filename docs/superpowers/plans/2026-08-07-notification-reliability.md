# Notification System Reliability & Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver real Web Push notifications for overdue bills (critical), bills due soon (urgent), and due reminders (reminder priority) that reach the user even when the phone is locked, the browser is backgrounded, or the PWA is fully closed — with dedupe, grouping, quiet hours, deep links, and a foreground in-app fallback.

**Architecture:** A Supabase Edge Function (`notify-sweep`), triggered every 15 minutes by `pg_cron`, scans `bills`/`reminders`, computes due-worthy states via pure functions, dedupes against a `notification_log` table, applies quiet hours from `notification_preferences`, groups same-priority items, and sends Web Push (VAPID) to every row in `push_subscriptions`. The client's service worker (`public/sw.js`) receives pushes in the background and deep-links taps back into the app. The existing foreground-only alert path (`lib/use-overdue-alerts.ts`) is kept and generalized as a fallback for when push isn't available.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + Edge Functions/Deno + `pg_cron`), `web-push` (Deno `npm:` import), Web Push API / Notification API, vitest + jsdom + Testing Library.

## Global Constraints

- Budget-threshold notifications are explicitly **out of scope** — `lib/budget-data.ts` is hardcoded mock data with no real backing table; do not wire a trigger to it.
- `bills`, `reminders`, and `categories` are global/shared tables (RLS gates on `authenticated`, not row ownership — see `supabase/migrations/0004_categories.sql`, `0006_bills.sql`, `0007_reminders.sql`). A due-worthy bill/reminder is not "owned" by one user — the sweep must fan out to every subscribed user.
- No mock notifications, no placeholder wiring — every task in this plan produces a real, working path.
- Currency display uses the ₱ symbol (see `app/(shell)/page.tsx:50`) — match this in any new user-facing notification copy.
- Follow existing repo conventions: manual row interfaces + `as RowType` casts for Supabase reads (no generated `Database` types exist in this repo — see `lib/reminders-repository.ts`), `lib/supabase/client.ts`'s `createClient()` for browser-side Supabase access.
- `DUE_SOON_WINDOW_DAYS = 3` already exists as the "due soon" window in `lib/bills-selectors.ts:5` — reuse the same value (duplicated as a documented constant in the Deno Edge Function, which cannot import from `lib/`).
- Supabase project `qxkgjxxuoxczyuvhcbal` (this app's project, from `.env.local`) is **not** reachable via the connected Supabase MCP tools in this environment — migration application, Edge Function deploy, secret configuration, and `pg_cron`/`pg_net`/Vault setup must be run by the user via the Supabase CLI or dashboard. Each task that needs this says so explicitly.

---

### Task 1: Notification data model migration

**Files:**
- Create: `supabase/migrations/0009_notifications.sql`

**Interfaces:**
- Produces: tables `public.push_subscriptions`, `public.notification_log`, `public.notification_preferences`, all consumed by later tasks' repository/Edge Function code.

- [ ] **Step 1: Write the migration**

```sql
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

-- Read-only for clients: the in-app fallback (Task 13) checks this table so
-- it doesn't double-notify for something the server already pushed. Writes
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
```

- [ ] **Step 2: Apply the migration**

This project's Supabase instance isn't reachable via MCP in this session. Run, with the
Supabase CLI authenticated against this project:

```bash
supabase db push
```

Confirm the three tables exist:

```bash
supabase db diff --linked
```

Expected: no diff (migration already applied matches local file).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0009_notifications.sql
git commit -m "feat: add push_subscriptions, notification_log, notification_preferences tables"
```

---

### Task 2: Client-side notification priority module

**Files:**
- Create: `lib/notification-priority.ts`
- Test: `lib/notification-priority.test.ts`

**Interfaces:**
- Produces: `NotificationPriority` type (`'critical' | 'urgent' | 'reminder'`), `VIBRATION_PATTERNS: Record<NotificationPriority, number[]>`, `REQUIRES_INTERACTION: Record<NotificationPriority, boolean>`, `bypassesQuietHours(priority: NotificationPriority): boolean`. Consumed by Task 12 (settings UI), Task 13 (fallback hook), and mirrored by hand into `public/sw.js` (Task 6) since a service worker script cannot import from `lib/`.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/notification-priority.test.ts
import { describe, expect, it } from 'vitest';
import { VIBRATION_PATTERNS, REQUIRES_INTERACTION, bypassesQuietHours } from './notification-priority';

describe('notification-priority', () => {
  it('defines a vibration pattern for every priority', () => {
    expect(VIBRATION_PATTERNS.critical).toEqual([400, 100, 400, 100, 400]);
    expect(VIBRATION_PATTERNS.urgent).toEqual([250, 100, 250]);
    expect(VIBRATION_PATTERNS.reminder).toEqual([150]);
  });

  it('only requires interaction for critical alerts', () => {
    expect(REQUIRES_INTERACTION.critical).toBe(true);
    expect(REQUIRES_INTERACTION.urgent).toBe(false);
    expect(REQUIRES_INTERACTION.reminder).toBe(false);
  });

  it('bypasses quiet hours for critical and urgent only', () => {
    expect(bypassesQuietHours('critical')).toBe(true);
    expect(bypassesQuietHours('urgent')).toBe(true);
    expect(bypassesQuietHours('reminder')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/notification-priority.test.ts`
Expected: FAIL with "Cannot find module './notification-priority'"

- [ ] **Step 3: Write the implementation**

```typescript
// lib/notification-priority.ts
export type NotificationPriority = 'critical' | 'urgent' | 'reminder';

export const VIBRATION_PATTERNS: Record<NotificationPriority, number[]> = {
  critical: [400, 100, 400, 100, 400],
  urgent: [250, 100, 250],
  reminder: [150],
};

export const REQUIRES_INTERACTION: Record<NotificationPriority, boolean> = {
  critical: true,
  urgent: false,
  reminder: false,
};

export function bypassesQuietHours(priority: NotificationPriority): boolean {
  return priority === 'critical' || priority === 'urgent';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/notification-priority.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/notification-priority.ts lib/notification-priority.test.ts
git commit -m "feat: add shared notification priority model"
```

---

### Task 3: Notification log repository (read-only dedupe lookup)

**Files:**
- Create: `lib/notification-log-repository.ts`
- Test: `lib/notification-log-repository.test.ts`

**Interfaces:**
- Consumes: `createClient` from `lib/supabase/client.ts`.
- Produces: `listSentStateKeys(): Promise<Set<string>>` — keys formatted as `` `${entityType}:${entityId}:${stateKey}` ``. Consumed by Task 13's fallback hook to avoid double-notifying for something the server sweep already pushed.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/notification-log-repository.test.ts
import { describe, expect, it, vi } from 'vitest';

const mockSelect = vi.fn();
vi.mock('./supabase/client', () => ({
  createClient: () => ({
    from: () => ({ select: mockSelect }),
  }),
}));

import { listSentStateKeys } from './notification-log-repository';

describe('listSentStateKeys', () => {
  it('returns a set of entityType:entityId:stateKey strings', async () => {
    mockSelect.mockResolvedValue({
      data: [
        { entity_type: 'bill', entity_id: 'b1', state_key: 'overdue' },
        { entity_type: 'reminder', entity_id: 'r1', state_key: 'due:2026-08-07' },
      ],
      error: null,
    });

    const result = await listSentStateKeys();

    expect(result).toEqual(new Set(['bill:b1:overdue', 'reminder:r1:due:2026-08-07']));
  });

  it('returns an empty set on error', async () => {
    mockSelect.mockResolvedValue({ data: null, error: new Error('boom') });

    const result = await listSentStateKeys();

    expect(result).toEqual(new Set());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/notification-log-repository.test.ts`
Expected: FAIL with "Cannot find module './notification-log-repository'"

- [ ] **Step 3: Write the implementation**

```typescript
// lib/notification-log-repository.ts
import { createClient } from './supabase/client';

interface NotificationLogRow {
  entity_type: string;
  entity_id: string;
  state_key: string;
}

export async function listSentStateKeys(): Promise<Set<string>> {
  const supabase = createClient();
  const { data, error } = await supabase.from('notification_log').select('entity_type, entity_id, state_key');
  if (error || !data) return new Set();
  return new Set((data as NotificationLogRow[]).map((row) => `${row.entity_type}:${row.entity_id}:${row.state_key}`));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/notification-log-repository.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/notification-log-repository.ts lib/notification-log-repository.test.ts
git commit -m "feat: add read-only notification log lookup for fallback dedupe"
```

---

### Task 4: Notification preferences repository

**Files:**
- Create: `lib/notification-preferences-repository.ts`
- Test: `lib/notification-preferences-repository.test.ts`

**Interfaces:**
- Consumes: `createClient` from `lib/supabase/client.ts`; `NotificationPriority` from `lib/notification-priority.ts`.
- Produces: `NotificationPreferences` interface (`quietHoursStart: string | null`, `quietHoursEnd: string | null`, `soundEnabled: boolean`, `enabledPriorities: NotificationPriority[]`), `getPreferences(): Promise<NotificationPreferences>` (returns defaults if no row exists yet), `upsertPreferences(input: NotificationPreferences): Promise<void>`. Consumed by Task 12 (settings UI).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/notification-preferences-repository.test.ts
import { describe, expect, it, vi } from 'vitest';

const mockSingle = vi.fn();
const mockUpsert = vi.fn();
vi.mock('./supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    from: () => ({
      select: () => ({ maybeSingle: mockSingle }),
      upsert: mockUpsert,
    }),
  }),
}));

import { getPreferences, upsertPreferences } from './notification-preferences-repository';

describe('getPreferences', () => {
  it('maps a stored row to camelCase', async () => {
    mockSingle.mockResolvedValue({
      data: {
        quiet_hours_start: '22:00:00',
        quiet_hours_end: '07:00:00',
        sound_enabled: false,
        enabled_priorities: ['critical'],
      },
      error: null,
    });

    const result = await getPreferences();

    expect(result).toEqual({
      quietHoursStart: '22:00:00',
      quietHoursEnd: '07:00:00',
      soundEnabled: false,
      enabledPriorities: ['critical'],
    });
  });

  it('returns defaults when no row exists yet', async () => {
    mockSingle.mockResolvedValue({ data: null, error: null });

    const result = await getPreferences();

    expect(result).toEqual({
      quietHoursStart: null,
      quietHoursEnd: null,
      soundEnabled: true,
      enabledPriorities: ['critical', 'urgent', 'reminder'],
    });
  });
});

describe('upsertPreferences', () => {
  it('writes snake_case columns scoped to the current user', async () => {
    mockUpsert.mockResolvedValue({ error: null });

    await upsertPreferences({
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      soundEnabled: true,
      enabledPriorities: ['critical', 'urgent'],
    });

    expect(mockUpsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      quiet_hours_start: '22:00',
      quiet_hours_end: '07:00',
      sound_enabled: true,
      enabled_priorities: ['critical', 'urgent'],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/notification-preferences-repository.test.ts`
Expected: FAIL with "Cannot find module './notification-preferences-repository'"

- [ ] **Step 3: Write the implementation**

```typescript
// lib/notification-preferences-repository.ts
import { createClient } from './supabase/client';
import type { NotificationPriority } from './notification-priority';

export interface NotificationPreferences {
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  soundEnabled: boolean;
  enabledPriorities: NotificationPriority[];
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  quietHoursStart: null,
  quietHoursEnd: null,
  soundEnabled: true,
  enabledPriorities: ['critical', 'urgent', 'reminder'],
};

interface PreferencesRow {
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  sound_enabled: boolean;
  enabled_priorities: string[];
}

export async function getPreferences(): Promise<NotificationPreferences> {
  const supabase = createClient();
  const { data, error } = await supabase.from('notification_preferences').select('*').maybeSingle();
  if (error || !data) return DEFAULT_PREFERENCES;

  const row = data as PreferencesRow;
  return {
    quietHoursStart: row.quiet_hours_start,
    quietHoursEnd: row.quiet_hours_end,
    soundEnabled: row.sound_enabled,
    enabledPriorities: row.enabled_priorities as NotificationPriority[],
  };
}

export async function upsertPreferences(input: NotificationPreferences): Promise<void> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  await supabase.from('notification_preferences').upsert({
    user_id: userData.user.id,
    quiet_hours_start: input.quietHoursStart,
    quiet_hours_end: input.quietHoursEnd,
    sound_enabled: input.soundEnabled,
    enabled_priorities: input.enabledPriorities,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/notification-preferences-repository.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/notification-preferences-repository.ts lib/notification-preferences-repository.test.ts
git commit -m "feat: add notification preferences repository"
```

---

### Task 5: Push subscription client wrapper

**Files:**
- Create: `lib/push-subscription.ts`
- Test: `lib/push-subscription.test.ts`

**Interfaces:**
- Consumes: `createClient` from `lib/supabase/client.ts`.
- Produces: `isPushSupported(): boolean`, `subscribeToPush(): Promise<boolean>`, `unsubscribeFromPush(): Promise<void>`, `getPushSubscriptionState(): Promise<'subscribed' | 'unsubscribed' | 'unsupported'>`. Consumed by Task 12 (settings UI).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/push-subscription.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockUpsert = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
mockDelete.mockReturnValue({ eq: mockEq });
vi.mock('./supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    from: () => ({ upsert: mockUpsert, delete: mockDelete }),
  }),
}));

import { isPushSupported, subscribeToPush, unsubscribeFromPush, getPushSubscriptionState } from './push-subscription';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('isPushSupported', () => {
  it('returns false when serviceWorker/PushManager are absent', () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('window', {});
    expect(isPushSupported()).toBe(false);
  });

  it('returns true when serviceWorker, PushManager, and Notification all exist', () => {
    vi.stubGlobal('navigator', { serviceWorker: {} });
    vi.stubGlobal('window', { PushManager: class {}, Notification: class {} });
    expect(isPushSupported()).toBe(true);
  });
});

describe('subscribeToPush', () => {
  it('returns false when push is unsupported', async () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('window', {});
    expect(await subscribeToPush()).toBe(false);
  });

  it('subscribes and upserts the subscription row', async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'QUFBQQ';
    mockUpsert.mockResolvedValue({ error: null });
    const subscribe = vi.fn().mockResolvedValue({
      toJSON: () => ({ endpoint: 'https://push.example/abc', keys: { p256dh: 'p256dh-key', auth: 'auth-key' } }),
    });
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.resolve({ pushManager: { subscribe } }) },
      userAgent: 'test-agent',
    });
    vi.stubGlobal('window', { PushManager: class {}, Notification: class {}, atob: (s: string) => Buffer.from(s, 'base64').toString('binary') });
    vi.stubGlobal('atob', (s: string) => Buffer.from(s, 'base64').toString('binary'));

    const result = await subscribeToPush();

    expect(subscribe).toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        endpoint: 'https://push.example/abc',
        p256dh: 'p256dh-key',
        auth: 'auth-key',
      }),
      { onConflict: 'endpoint' }
    );
    expect(result).toBe(true);
  });
});

describe('unsubscribeFromPush', () => {
  it('unsubscribes and deletes the subscription row by endpoint', async () => {
    mockEq.mockResolvedValue({ error: null });
    const unsubscribe = vi.fn().mockResolvedValue(true);
    const getSubscription = vi.fn().mockResolvedValue({ endpoint: 'https://push.example/abc', unsubscribe });
    vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve({ pushManager: { getSubscription } }) } });
    vi.stubGlobal('window', { PushManager: class {}, Notification: class {} });

    await unsubscribeFromPush();

    expect(unsubscribe).toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith('endpoint', 'https://push.example/abc');
  });
});

describe('getPushSubscriptionState', () => {
  it('returns unsupported when push is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('window', {});
    expect(await getPushSubscriptionState()).toBe('unsupported');
  });

  it('returns subscribed when an active subscription exists', async () => {
    const getSubscription = vi.fn().mockResolvedValue({ endpoint: 'https://push.example/abc' });
    vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve({ pushManager: { getSubscription } }) } });
    vi.stubGlobal('window', { PushManager: class {}, Notification: class {} });
    expect(await getPushSubscriptionState()).toBe('subscribed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/push-subscription.test.ts`
Expected: FAIL with "Cannot find module './push-subscription'"

- [ ] **Step 3: Write the implementation**

```typescript
// lib/push-subscription.ts
import { createClient } from './supabase/client';

export function isPushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    typeof window.Notification !== 'undefined'
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) return false;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userData.user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: 'endpoint' }
  );

  return !error;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  const supabase = createClient();
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
}

export async function getPushSubscriptionState(): Promise<'subscribed' | 'unsubscribed' | 'unsupported'> {
  if (!isPushSupported()) return 'unsupported';
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return subscription ? 'subscribed' : 'unsubscribed';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/push-subscription.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/push-subscription.ts lib/push-subscription.test.ts
git commit -m "feat: add push subscription client wrapper"
```

---

### Task 6: Service worker push + notificationclick handlers

**Files:**
- Modify: `public/sw.js`
- Test: `public/sw.test.ts`

**Interfaces:**
- Consumes: push payload JSON shape `{ title: string, body: string, tag: string, url: string, priority: 'critical'|'urgent'|'reminder' }`, produced by Task 8's Edge Function and Task 9's grouping module.
- Produces: background notification display + deep-link-on-tap behavior. `VIBRATE_PATTERNS` inside `sw.js` intentionally mirrors `lib/notification-priority.ts`'s `VIBRATION_PATTERNS` — a service worker script (loaded directly by the browser, not bundled by Next) cannot `import` from `lib/`.

- [ ] **Step 1: Write the failing test**

```typescript
// public/sw.test.ts
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadServiceWorker() {
  const source = readFileSync(path.resolve(__dirname, 'sw.js'), 'utf-8');
  const listeners: Record<string, ((event: unknown) => unknown)[]> = {};

  const self: {
    addEventListener: (type: string, handler: (event: unknown) => unknown) => void;
    location: { origin: string };
    registration: { showNotification: ReturnType<typeof vi.fn> };
    clients: { matchAll: ReturnType<typeof vi.fn>; openWindow: ReturnType<typeof vi.fn> };
    skipWaiting: ReturnType<typeof vi.fn>;
  } = {
    addEventListener: (type, handler) => {
      listeners[type] = listeners[type] ?? [];
      listeners[type].push(handler);
    },
    location: { origin: 'https://app.example' },
    registration: { showNotification: vi.fn() },
    clients: { matchAll: vi.fn(), openWindow: vi.fn() },
    skipWaiting: vi.fn(),
  };
  const caches = { keys: vi.fn().mockResolvedValue([]), open: vi.fn(), delete: vi.fn() };

  runInNewContext(source, { self, caches, fetch: vi.fn(), URL });

  return { self, listeners };
}

describe('sw.js push handling', () => {
  it('shows a notification built from the push payload', async () => {
    const { self, listeners } = loadServiceWorker();
    const payload = {
      title: 'Bill overdue',
      body: '₱84.50 overdue',
      tag: 'critical-group',
      url: '/bills?open=abc',
      priority: 'critical',
    };
    const event = { data: { json: () => payload }, waitUntil: (p: Promise<unknown>) => p };

    for (const handler of listeners.push) await handler(event);

    expect(self.registration.showNotification).toHaveBeenCalledWith(
      'Bill overdue',
      expect.objectContaining({
        body: '₱84.50 overdue',
        tag: 'critical-group',
        requireInteraction: true,
        vibrate: [400, 100, 400, 100, 400],
        data: { url: '/bills?open=abc' },
      })
    );
  });

  it('does nothing when the push event carries no data', async () => {
    const { self, listeners } = loadServiceWorker();
    const event = { data: null, waitUntil: vi.fn() };

    for (const handler of listeners.push) await handler(event);

    expect(self.registration.showNotification).not.toHaveBeenCalled();
  });
});

describe('sw.js notificationclick handling', () => {
  it('focuses an existing client at the app origin instead of opening a new one', async () => {
    const { self, listeners } = loadServiceWorker();
    const focus = vi.fn();
    const postMessage = vi.fn();
    self.clients.matchAll.mockResolvedValue([{ url: 'https://app.example/', focus, postMessage }]);
    const notification = { close: vi.fn(), data: { url: '/bills?open=abc' } };
    const event = { notification, waitUntil: (p: Promise<unknown>) => p };

    for (const handler of listeners.notificationclick) await handler(event);

    expect(notification.close).toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith({ type: 'notification-click', url: '/bills?open=abc' });
    expect(focus).toHaveBeenCalled();
    expect(self.clients.openWindow).not.toHaveBeenCalled();
  });

  it('opens a new window when no matching client is open', async () => {
    const { self, listeners } = loadServiceWorker();
    self.clients.matchAll.mockResolvedValue([]);
    const notification = { close: vi.fn(), data: { url: '/reminders?open=xyz' } };
    const event = { notification, waitUntil: (p: Promise<unknown>) => p };

    for (const handler of listeners.notificationclick) await handler(event);

    expect(self.clients.openWindow).toHaveBeenCalledWith('/reminders?open=xyz');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run public/sw.test.ts`
Expected: FAIL — `listeners.push` is undefined (no `push` listener registered yet)

- [ ] **Step 3: Add the push and notificationclick handlers to `sw.js`**

Append to the end of `public/sw.js` (the existing `install`/`activate`/`fetch` handlers stay untouched):

```javascript
// Mirrors lib/notification-priority.ts's VIBRATION_PATTERNS -- a service
// worker script is loaded directly by the browser (not bundled by Next),
// so it cannot import from lib/. Keep these two in sync by hand; both are
// covered by tests that pin the exact array values.
const VIBRATE_PATTERNS = {
  critical: [400, 100, 400, 100, 400],
  urgent: [250, 100, 250],
  reminder: [150],
};

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const priority = payload.priority || 'reminder';

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: VIBRATE_PATTERNS[priority] || VIBRATE_PATTERNS.reminder,
      requireInteraction: priority === 'critical',
      data: { url: payload.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin && 'focus' in client) {
          client.postMessage({ type: 'notification-click', url: targetUrl });
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run public/sw.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add public/sw.js public/sw.test.ts
git commit -m "feat: handle background push and notification-tap deep links in the service worker"
```

---

### Task 7: Edge Function priority computation (pure, dependency-free)

**Files:**
- Create: `supabase/functions/notify-sweep/priority.ts`
- Test: `supabase/functions/notify-sweep/priority.test.ts`

**Interfaces:**
- Produces: `DUE_SOON_WINDOW_DAYS = 3`, `BillRow`/`ReminderRow` interfaces, `EntityState` interface (`{ entityType: 'bill'|'reminder', entityId: string, priority: NotificationPriority, stateKey: string }`), `computeBillState(bill: BillRow, todayISO: string): EntityState | null`, `computeReminderState(reminder: ReminderRow, todayISO: string): EntityState | null`. This file has zero imports (works identically under Deno at runtime and under vitest/Node for testing) and is consumed by Task 9's Edge Function `index.ts`.

- [ ] **Step 1: Write the failing test**

```typescript
// supabase/functions/notify-sweep/priority.test.ts
import { describe, expect, it } from 'vitest';
import { computeBillState, computeReminderState } from './priority';

const TODAY = '2026-08-07';

describe('computeBillState', () => {
  it('returns null for a paid bill regardless of due date', () => {
    expect(computeBillState({ id: 'b1', due_date: '2026-08-01', paid: true }, TODAY)).toBeNull();
  });

  it('marks a past-due unpaid bill as critical with a stable state key', () => {
    expect(computeBillState({ id: 'b1', due_date: '2026-08-01', paid: false }, TODAY)).toEqual({
      entityType: 'bill',
      entityId: 'b1',
      priority: 'critical',
      stateKey: 'overdue',
    });
  });

  it('marks a bill due today as urgent', () => {
    expect(computeBillState({ id: 'b1', due_date: TODAY, paid: false }, TODAY)).toEqual({
      entityType: 'bill',
      entityId: 'b1',
      priority: 'urgent',
      stateKey: 'due_soon:2026-08-07',
    });
  });

  it('marks a bill due within the 3-day window as urgent', () => {
    expect(computeBillState({ id: 'b1', due_date: '2026-08-10', paid: false }, TODAY)).toEqual({
      entityType: 'bill',
      entityId: 'b1',
      priority: 'urgent',
      stateKey: 'due_soon:2026-08-10',
    });
  });

  it('returns null for a bill due more than 3 days out', () => {
    expect(computeBillState({ id: 'b1', due_date: '2026-08-11', paid: false }, TODAY)).toBeNull();
  });
});

describe('computeReminderState', () => {
  it('returns null for a completed reminder', () => {
    expect(computeReminderState({ id: 'r1', due_date: '2026-08-01', completed: true }, TODAY)).toBeNull();
  });

  it('marks a due-or-overdue incomplete reminder as reminder priority', () => {
    expect(computeReminderState({ id: 'r1', due_date: TODAY, completed: false }, TODAY)).toEqual({
      entityType: 'reminder',
      entityId: 'r1',
      priority: 'reminder',
      stateKey: 'due:2026-08-07',
    });
  });

  it('returns null for a reminder due in the future', () => {
    expect(computeReminderState({ id: 'r1', due_date: '2026-08-08', completed: false }, TODAY)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/notify-sweep/priority.test.ts`
Expected: FAIL with "Cannot find module './priority'"

- [ ] **Step 3: Write the implementation**

```typescript
// supabase/functions/notify-sweep/priority.ts
// Pure, dependency-free TypeScript: this file is imported both by the Deno
// Edge Function runtime (index.ts, via a relative import) and directly by
// vitest/Node for testing. Do not add any import here -- that's what keeps
// both runtimes able to load it unmodified.

export type NotificationPriority = 'critical' | 'urgent' | 'reminder';

export const DUE_SOON_WINDOW_DAYS = 3;

export interface EntityState {
  entityType: 'bill' | 'reminder';
  entityId: string;
  priority: NotificationPriority;
  stateKey: string;
}

export interface BillRow {
  id: string;
  due_date: string; // ISO 'yyyy-MM-dd'
  paid: boolean;
}

export interface ReminderRow {
  id: string;
  due_date: string; // ISO 'yyyy-MM-dd'
  completed: boolean;
}

function addDaysToISODate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function computeBillState(bill: BillRow, todayISO: string): EntityState | null {
  if (bill.paid) return null;

  if (bill.due_date < todayISO) {
    return { entityType: 'bill', entityId: bill.id, priority: 'critical', stateKey: 'overdue' };
  }

  const dueSoonEnd = addDaysToISODate(todayISO, DUE_SOON_WINDOW_DAYS);
  if (bill.due_date <= dueSoonEnd) {
    return { entityType: 'bill', entityId: bill.id, priority: 'urgent', stateKey: `due_soon:${bill.due_date}` };
  }

  return null;
}

export function computeReminderState(reminder: ReminderRow, todayISO: string): EntityState | null {
  if (reminder.completed) return null;

  if (reminder.due_date <= todayISO) {
    return { entityType: 'reminder', entityId: reminder.id, priority: 'reminder', stateKey: `due:${reminder.due_date}` };
  }

  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/notify-sweep/priority.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/notify-sweep/priority.ts supabase/functions/notify-sweep/priority.test.ts
git commit -m "feat: add pure bill/reminder due-state computation for the notify-sweep function"
```

---

### Task 8: Edge Function grouping module

**Files:**
- Create: `supabase/functions/notify-sweep/grouping.ts`
- Test: `supabase/functions/notify-sweep/grouping.test.ts`

**Interfaces:**
- Consumes: `NotificationPriority` from `./priority.ts` (Task 7).
- Produces: `NotifiableItem` interface (`{ priority, title, amount?, dueDate, url }`), `GroupedNotification` interface (`{ priority, title, body, tag, url }`), `groupByPriority(items: NotifiableItem[]): GroupedNotification[]`. Consumed by Task 9's Edge Function `index.ts`.

- [ ] **Step 1: Write the failing test**

```typescript
// supabase/functions/notify-sweep/grouping.test.ts
import { describe, expect, it } from 'vitest';
import { groupByPriority } from './grouping';

describe('groupByPriority', () => {
  it('keeps full detail for a single item', () => {
    const groups = groupByPriority([
      { priority: 'critical', title: 'Electricity Bill', amount: 84.5, dueDate: '2026-08-01', url: '/bills?open=b1' },
    ]);

    expect(groups).toEqual([
      {
        priority: 'critical',
        title: 'Electricity Bill',
        body: '₱84.50 overdue — 2026-08-01',
        tag: 'critical-/bills?open=b1',
        url: '/bills?open=b1',
      },
    ]);
  });

  it('summarizes multiple same-priority items into one group', () => {
    const groups = groupByPriority([
      { priority: 'critical', title: 'Electricity Bill', amount: 84.5, dueDate: '2026-08-01', url: '/bills?open=b1' },
      { priority: 'critical', title: 'Internet Bill', amount: 59.99, dueDate: '2026-08-02', url: '/bills?open=b2' },
    ]);

    expect(groups).toEqual([
      {
        priority: 'critical',
        title: '2 bills overdue',
        body: 'Electricity Bill, Internet Bill: ₱144.49 total',
        tag: 'critical-group',
        url: '/bills',
      },
    ]);
  });

  it('produces one group per distinct priority', () => {
    const groups = groupByPriority([
      { priority: 'critical', title: 'Electricity Bill', amount: 84.5, dueDate: '2026-08-01', url: '/bills?open=b1' },
      { priority: 'reminder', title: "Mom's birthday", dueDate: '2026-08-07', url: '/reminders?open=r1' },
    ]);

    expect(groups.map((g) => g.priority).sort()).toEqual(['critical', 'reminder']);
  });

  it('groups reminders without an amount', () => {
    const groups = groupByPriority([
      { priority: 'reminder', title: "Mom's birthday", dueDate: '2026-08-07', url: '/reminders?open=r1' },
    ]);

    expect(groups[0].body).toBe('due — 2026-08-07');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/notify-sweep/grouping.test.ts`
Expected: FAIL with "Cannot find module './grouping'"

- [ ] **Step 3: Write the implementation**

```typescript
// supabase/functions/notify-sweep/grouping.ts
import type { NotificationPriority } from './priority.ts';

export interface NotifiableItem {
  priority: NotificationPriority;
  title: string;
  amount?: number;
  dueDate: string;
  url: string;
}

export interface GroupedNotification {
  priority: NotificationPriority;
  title: string;
  body: string;
  tag: string;
  url: string;
}

const PRIORITY_VERB: Record<NotificationPriority, string> = {
  critical: 'overdue',
  urgent: 'due soon',
  reminder: 'due',
};

const LIST_URL: Record<NotificationPriority, string> = {
  critical: '/bills',
  urgent: '/bills',
  reminder: '/reminders',
};

const ENTITY_NOUN: Record<NotificationPriority, string> = {
  critical: 'bills',
  urgent: 'bills',
  reminder: 'reminders',
};

export function groupByPriority(items: NotifiableItem[]): GroupedNotification[] {
  const byPriority = new Map<NotificationPriority, NotifiableItem[]>();
  for (const item of items) {
    const list = byPriority.get(item.priority) ?? [];
    list.push(item);
    byPriority.set(item.priority, list);
  }

  const groups: GroupedNotification[] = [];
  for (const [priority, group] of byPriority) {
    if (group.length === 1) {
      const item = group[0];
      const amountText = item.amount !== undefined ? `₱${item.amount.toFixed(2)} ` : '';
      groups.push({
        priority,
        title: item.title,
        body: `${amountText}${PRIORITY_VERB[priority]} — ${item.dueDate}`,
        tag: `${priority}-${item.url}`,
        url: item.url,
      });
    } else {
      const total = group.reduce((sum, item) => sum + (item.amount ?? 0), 0);
      const totalText = total > 0 ? `: ₱${total.toFixed(2)} total` : '';
      groups.push({
        priority,
        title: `${group.length} ${ENTITY_NOUN[priority]} ${PRIORITY_VERB[priority]}`,
        body: `${group.map((item) => item.title).join(', ')}${totalText}`,
        tag: `${priority}-group`,
        url: LIST_URL[priority],
      });
    }
  }
  return groups;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/notify-sweep/grouping.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/notify-sweep/grouping.ts supabase/functions/notify-sweep/grouping.test.ts
git commit -m "feat: add notification grouping for the notify-sweep function"
```

---

### Task 9: `notify-sweep` Edge Function

**Files:**
- Create: `supabase/functions/notify-sweep/index.ts`

**Interfaces:**
- Consumes: `computeBillState`, `computeReminderState` from `./priority.ts` (Task 7); `groupByPriority`, `NotifiableItem` from `./grouping.ts` (Task 8); reads `bills`, `reminders`, `push_subscriptions`, `notification_preferences`, `notification_log` tables (Task 1); env vars `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
- Produces: an HTTP endpoint invoked by `pg_cron` (Task 11).

This function runs on Deno against live infrastructure (real Postgres rows, real push
service network calls) — it is not practical to unit test with vitest. It's exercised
manually in Step 3 below, and its core logic (state computation, grouping) is already
covered by Tasks 7–8's tests.

- [ ] **Step 1: Write the Edge Function**

```typescript
// supabase/functions/notify-sweep/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';
import { computeBillState, computeReminderState, type BillRow, type ReminderRow } from './priority.ts';
import { groupByPriority, type NotifiableItem } from './grouping.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface PreferencesRow {
  user_id: string;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  enabled_priorities: string[];
}

interface LogRow {
  user_id: string;
  entity_type: string;
  entity_id: string;
  state_key: string;
}

function isWithinQuietHours(start: string | null, end: string | null, nowMinutes: number): boolean {
  if (!start || !end) return false;
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  if (startMinutes === endMinutes) return false;
  if (startMinutes < endMinutes) return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  return nowMinutes >= startMinutes || nowMinutes < endMinutes; // window wraps past midnight
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const todayISO = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  const [billsRes, remindersRes, subsRes, prefsRes, logRes] = await Promise.all([
    supabase.from('bills').select('id, title, amount, due_date, paid'),
    supabase.from('reminders').select('id, title, due_date, completed'),
    supabase.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth'),
    supabase.from('notification_preferences').select('user_id, quiet_hours_start, quiet_hours_end, enabled_priorities'),
    supabase.from('notification_log').select('user_id, entity_type, entity_id, state_key'),
  ]);

  const bills = (billsRes.data ?? []) as (BillRow & { title: string; amount: number })[];
  const reminders = (remindersRes.data ?? []) as (ReminderRow & { title: string })[];
  const subscriptions = (subsRes.data ?? []) as PushSubscriptionRow[];
  const preferences = (prefsRes.data ?? []) as PreferencesRow[];
  const sentLog = (logRes.data ?? []) as LogRow[];

  const billStates = bills.map((bill) => computeBillState(bill, todayISO)).filter((s) => s !== null);
  const reminderStates = reminders.map((reminder) => computeReminderState(reminder, todayISO)).filter((s) => s !== null);

  const subscriptionsByUser = new Map<string, PushSubscriptionRow[]>();
  for (const sub of subscriptions) {
    const list = subscriptionsByUser.get(sub.user_id) ?? [];
    list.push(sub);
    subscriptionsByUser.set(sub.user_id, list);
  }

  const logInserts: LogRow[] = [];
  const staleSubscriptionIds: string[] = [];

  for (const [userId, userSubs] of subscriptionsByUser) {
    const pref = preferences.find((p) => p.user_id === userId);
    const enabledPriorities = new Set(pref?.enabled_priorities ?? ['critical', 'urgent', 'reminder']);
    const alreadySent = new Set(
      sentLog.filter((l) => l.user_id === userId).map((l) => `${l.entity_type}:${l.entity_id}:${l.state_key}`)
    );
    const inQuietHours = pref ? isWithinQuietHours(pref.quiet_hours_start, pref.quiet_hours_end, nowMinutes) : false;

    const candidates: { item: NotifiableItem; logEntry: LogRow }[] = [];

    // Bills are always critical/urgent, which bypass quiet hours by design.
    for (const state of billStates) {
      const key = `${state.entityType}:${state.entityId}:${state.stateKey}`;
      if (alreadySent.has(key) || !enabledPriorities.has(state.priority)) continue;
      const bill = bills.find((b) => b.id === state.entityId)!;
      candidates.push({
        item: { priority: state.priority, title: bill.title, amount: Number(bill.amount), dueDate: bill.due_date, url: `/bills?open=${bill.id}` },
        logEntry: { user_id: userId, entity_type: 'bill', entity_id: bill.id, state_key: state.stateKey },
      });
    }

    // Reminders are always 'reminder' priority, which respects quiet hours.
    if (!inQuietHours) {
      for (const state of reminderStates) {
        const key = `${state.entityType}:${state.entityId}:${state.stateKey}`;
        if (alreadySent.has(key) || !enabledPriorities.has(state.priority)) continue;
        const reminder = reminders.find((r) => r.id === state.entityId)!;
        candidates.push({
          item: { priority: state.priority, title: reminder.title, dueDate: reminder.due_date, url: `/reminders?open=${reminder.id}` },
          logEntry: { user_id: userId, entity_type: 'reminder', entity_id: reminder.id, state_key: state.stateKey },
        });
      }
    }

    if (candidates.length === 0) continue;

    const groups = groupByPriority(candidates.map((c) => c.item));

    for (const group of groups) {
      const payload = JSON.stringify({ title: group.title, body: group.body, tag: group.tag, url: group.url, priority: group.priority });

      for (const sub of userSubs) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) staleSubscriptionIds.push(sub.id);
        }
      }
    }

    logInserts.push(...candidates.map((c) => ({ ...c.logEntry, priority: c.item.priority })));
  }

  if (logInserts.length > 0) {
    await supabase.from('notification_log').insert(logInserts);
  }
  if (staleSubscriptionIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', staleSubscriptionIds);
  }

  return new Response(JSON.stringify({ notified: logInserts.length, staleRemoved: staleSubscriptionIds.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

Note: `logInserts` entries need a `priority` column value for the `notification_log` insert (Task 1's schema requires `priority not null`) — the spread above (`{ ...c.logEntry, priority: c.item.priority }`) adds it at push time; update the `LogRow` interface's usages accordingly (the `logInserts` array itself holds `LogRow & { priority: string }` in practice — TypeScript infers this fine from the spread, no separate type needed since it's Deno-side and not shared elsewhere).

- [ ] **Step 2: Deploy and smoke-test manually**

This requires the Supabase CLI authenticated against project `qxkgjxxuoxczyuvhcbal`
(not reachable via MCP in this environment):

```bash
supabase functions deploy notify-sweep --no-verify-jwt
```

Seed one overdue unpaid bill and one subscribed device (via Task 5's `subscribeToPush()`
in the running app), then invoke directly:

```bash
curl -i -X POST "https://qxkgjxxuoxczyuvhcbal.supabase.co/functions/v1/notify-sweep" \
  -H "Authorization: Bearer <service-role-or-anon-key>"
```

Expected: `200` response with `{"notified":1,"staleRemoved":0}` (or however many
due-worthy items exist), and a real push notification appears on the subscribed device.
Re-run the same `curl` immediately after — expected: `{"notified":0,...}`, confirming
dedupe (no second notification for the same bill/state).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/notify-sweep/index.ts
git commit -m "feat: add notify-sweep Edge Function to send Web Push for due bills and reminders"
```

---

### Task 10: VAPID keys and Edge Function secrets

**Files:** none (infrastructure setup — no repo files change besides `.env.local`, which is gitignored)

**Interfaces:**
- Produces: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (client env var, consumed by Task 5's `subscribeToPush()`), and the `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` Edge Function secrets consumed by Task 9's `index.ts`.

- [ ] **Step 1: Generate a VAPID key pair**

```bash
npx web-push generate-vapid-keys
```

Expected output: a `Public Key` and `Private Key` pair.

- [ ] **Step 2: Add the public key to local client env**

Append to `.env.local` (already gitignored — do not commit):

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key from step 1>
```

- [ ] **Step 3: Set Edge Function secrets on the Supabase project**

```bash
supabase secrets set VAPID_PUBLIC_KEY=<public key from step 1>
supabase secrets set VAPID_PRIVATE_KEY=<private key from step 1>
supabase secrets set VAPID_SUBJECT=mailto:sil@hhccs.com.au
```

- [ ] **Step 4: Add the same public key to the production hosting environment**

Whatever platform serves the production build (e.g. Vercel project settings) needs
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` set to the same public key from Step 1, so the deployed
client requests push subscriptions with a key the deployed Edge Function actually holds
the matching private key for.

No commit for this task — it's infrastructure configuration only.

---

### Task 11: `pg_cron` schedule for the sweep

**Files:**
- Create: `supabase/migrations/0010_notification_cron.sql`

**Interfaces:**
- Consumes: the deployed `notify-sweep` function URL (Task 9), a Vault-stored secret holding the function's bearer key (set manually — never committed).

- [ ] **Step 1: Write the migration**

```sql
-- Schedules the notify-sweep Edge Function every 15 minutes. Both
-- bills.due_date and reminders.due_date are DATE columns with no
-- time-of-day precision, so a single 15-minute cadence is sufficient for
-- both -- see the design spec's Architecture section for why a tighter,
-- separate reminder schedule isn't needed.
--
-- The function call authenticates with a bearer key pulled from Supabase
-- Vault by name ('notify_sweep_key') rather than a literal value, so no
-- secret is ever committed to this file. That secret must be created once,
-- manually, after this migration runs -- see Step 2.

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
```

- [ ] **Step 2: Apply the migration and create the Vault secret**

```bash
supabase db push
```

Then, in the Supabase SQL editor (not committed anywhere — this is a live secret value):

```sql
select vault.create_secret('<service-role-or-anon-key-with-invoke-rights>', 'notify_sweep_key');
```

- [ ] **Step 3: Verify the schedule is registered**

```sql
select * from cron.job where jobname = 'notify-sweep-every-15-min';
```

Expected: one row, `active = true`. Wait 15 minutes (or run
`select cron.schedule_in_database(...)` manually against a test job) and check
`cron.job_run_details` for a `succeeded` status.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0010_notification_cron.sql
git commit -m "feat: schedule notify-sweep via pg_cron every 15 minutes"
```

---

### Task 12: NotificationSettings — permission states, push wiring, quiet hours, priority toggles

**Files:**
- Modify: `components/dashboard/NotificationSettings.tsx`
- Modify: `components/dashboard/NotificationSettings.test.tsx`

**Interfaces:**
- Consumes: `NotificationPriority` from `lib/notification-priority.ts` (Task 2).
- Produces: extended `NotificationSettingsProps` (adds `permission: NotificationPermission | 'unsupported'`, `quietHoursStart: string | null`, `quietHoursEnd: string | null`, `onQuietHoursChange: (start: string | null, end: string | null) => void`, `enabledPriorities: NotificationPriority[]`, `onTogglePriority: (priority: NotificationPriority) => void`). Consumed by Task 14's `HomePage` wiring.

- [ ] **Step 1: Write the failing/updated tests**

```typescript
// components/dashboard/NotificationSettings.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationSettings } from './NotificationSettings';

const baseProps = {
  onRequestPermission: vi.fn(),
  soundEnabled: true,
  onToggleSound: vi.fn(),
  quietHoursStart: null,
  quietHoursEnd: null,
  onQuietHoursChange: vi.fn(),
  enabledPriorities: ['critical', 'urgent', 'reminder'] as const,
  onTogglePriority: vi.fn(),
};

describe('NotificationSettings', () => {
  it('shows an Enable button when permission has not been decided', () => {
    render(<NotificationSettings {...baseProps} permission="default" />);
    expect(screen.getByTestId('enable-notifications-button')).toBeInTheDocument();
    expect(screen.queryByTestId('sound-toggle-button')).not.toBeInTheDocument();
  });

  it('calls onRequestPermission when Enable is clicked', () => {
    const onRequestPermission = vi.fn();
    render(<NotificationSettings {...baseProps} permission="default" onRequestPermission={onRequestPermission} />);
    fireEvent.click(screen.getByTestId('enable-notifications-button'));
    expect(onRequestPermission).toHaveBeenCalled();
  });

  it('shows the sound toggle, quiet hours, and priority toggles once permission is granted', () => {
    render(<NotificationSettings {...baseProps} permission="granted" />);
    expect(screen.queryByTestId('enable-notifications-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('sound-toggle-button')).toBeInTheDocument();
    expect(screen.getByTestId('quiet-hours-start')).toBeInTheDocument();
    expect(screen.getByTestId('quiet-hours-end')).toBeInTheDocument();
    expect(screen.getByTestId('priority-toggle-critical')).toBeInTheDocument();
    expect(screen.getByTestId('priority-toggle-urgent')).toBeInTheDocument();
    expect(screen.getByTestId('priority-toggle-reminder')).toBeInTheDocument();
  });

  it('calls onToggleSound when the sound button is clicked', () => {
    const onToggleSound = vi.fn();
    render(<NotificationSettings {...baseProps} permission="granted" onToggleSound={onToggleSound} />);
    fireEvent.click(screen.getByTestId('sound-toggle-button'));
    expect(onToggleSound).toHaveBeenCalled();
  });

  it('calls onQuietHoursChange when the start time changes', () => {
    const onQuietHoursChange = vi.fn();
    render(<NotificationSettings {...baseProps} permission="granted" onQuietHoursChange={onQuietHoursChange} />);
    fireEvent.change(screen.getByTestId('quiet-hours-start'), { target: { value: '22:00' } });
    expect(onQuietHoursChange).toHaveBeenCalledWith('22:00', null);
  });

  it('calls onTogglePriority when a priority checkbox is clicked', () => {
    const onTogglePriority = vi.fn();
    render(<NotificationSettings {...baseProps} permission="granted" onTogglePriority={onTogglePriority} />);
    fireEvent.click(screen.getByTestId('priority-toggle-reminder'));
    expect(onTogglePriority).toHaveBeenCalledWith('reminder');
  });

  it('shows a blocked message with re-enable instructions when permission is denied', () => {
    render(<NotificationSettings {...baseProps} permission="denied" />);
    expect(screen.getByTestId('notification-settings')).toHaveTextContent('Blocked');
    expect(screen.getByTestId('notification-settings')).toHaveTextContent('browser');
    expect(screen.queryByTestId('enable-notifications-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sound-toggle-button')).not.toBeInTheDocument();
  });

  it('shows an unsupported message with no action buttons when push is unavailable', () => {
    render(<NotificationSettings {...baseProps} permission="unsupported" />);
    expect(screen.getByTestId('notification-settings')).toHaveTextContent('Not supported');
    expect(screen.queryByTestId('enable-notifications-button')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify failures**

Run: `npx vitest run components/dashboard/NotificationSettings.test.tsx`
Expected: FAIL — new props/testids don't exist yet on the current component

- [ ] **Step 3: Rewrite the component**

```tsx
// components/dashboard/NotificationSettings.tsx
'use client';

import { Bell, BellOff, Volume2, VolumeX } from 'lucide-react';
import type { NotificationPriority } from '@/lib/notification-priority';

export type NotificationPermissionState = NotificationPermission | 'unsupported';

interface NotificationSettingsProps {
  permission: NotificationPermissionState;
  onRequestPermission: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  onQuietHoursChange: (start: string | null, end: string | null) => void;
  enabledPriorities: readonly NotificationPriority[];
  onTogglePriority: (priority: NotificationPriority) => void;
}

const STATUS_TEXT: Record<NotificationPermissionState, string> = {
  granted: 'Enabled — you will be alerted even when the app is closed',
  denied: 'Blocked — re-enable notifications in your browser or device settings',
  default: 'Get notified about overdue bills, due dates, and reminders',
  unsupported: 'Not supported on this browser or device',
};

const PRIORITY_LABELS: Record<NotificationPriority, string> = {
  critical: 'Overdue bills',
  urgent: 'Bills due soon',
  reminder: 'Reminders',
};

export function NotificationSettings({
  permission,
  onRequestPermission,
  soundEnabled,
  onToggleSound,
  quietHoursStart,
  quietHoursEnd,
  onQuietHoursChange,
  enabledPriorities,
  onTogglePriority,
}: NotificationSettingsProps) {
  return (
    <div data-testid="notification-settings" className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {permission === 'granted' ? (
            <Bell className="h-4 w-4 text-gold" />
          ) : (
            <BellOff className="h-4 w-4 text-neutral-400" />
          )}
          <div>
            <p className="text-sm font-medium text-neutral-900">Alerts</p>
            <p className="text-xs text-neutral-500">{STATUS_TEXT[permission]}</p>
          </div>
        </div>
        {permission === 'default' && (
          <button
            type="button"
            data-testid="enable-notifications-button"
            onClick={onRequestPermission}
            className="rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white"
          >
            Enable
          </button>
        )}
        {permission === 'granted' && (
          <button
            type="button"
            data-testid="sound-toggle-button"
            aria-label={soundEnabled ? 'Mute alert sound' : 'Unmute alert sound'}
            aria-pressed={soundEnabled}
            onClick={onToggleSound}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200"
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 text-neutral-600" />
            ) : (
              <VolumeX className="h-4 w-4 text-neutral-400" />
            )}
          </button>
        )}
      </div>

      {permission === 'granted' && (
        <>
          <div className="flex items-center gap-2 text-xs text-neutral-600">
            <label className="flex items-center gap-1">
              Quiet hours
              <input
                type="time"
                data-testid="quiet-hours-start"
                value={quietHoursStart ?? ''}
                onChange={(e) => onQuietHoursChange(e.target.value || null, quietHoursEnd)}
                className="rounded border border-neutral-200 px-1 py-0.5"
              />
            </label>
            <span>to</span>
            <input
              type="time"
              data-testid="quiet-hours-end"
              value={quietHoursEnd ?? ''}
              onChange={(e) => onQuietHoursChange(quietHoursStart, e.target.value || null)}
              className="rounded border border-neutral-200 px-1 py-0.5"
            />
          </div>
          <div className="flex flex-col gap-1">
            {(Object.keys(PRIORITY_LABELS) as NotificationPriority[]).map((priority) => (
              <label key={priority} className="flex items-center gap-2 text-xs text-neutral-600">
                <input
                  type="checkbox"
                  data-testid={`priority-toggle-${priority}`}
                  checked={enabledPriorities.includes(priority)}
                  onChange={() => onTogglePriority(priority)}
                />
                {PRIORITY_LABELS[priority]}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/dashboard/NotificationSettings.test.tsx`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/NotificationSettings.tsx components/dashboard/NotificationSettings.test.tsx
git commit -m "feat: add unsupported/denied states, quiet hours, and priority toggles to NotificationSettings"
```

---

### Task 13: Generalize the foreground fallback hook

**Files:**
- Modify: `lib/use-overdue-alerts.ts`
- Modify: `lib/use-overdue-alerts.test.ts` (create if it doesn't already exist — check first with `ls lib/use-overdue-alerts.test.ts`)

**Interfaces:**
- Consumes: `NotificationPriority`, `VIBRATION_PATTERNS`, `REQUIRES_INTERACTION` from `lib/notification-priority.ts` (Task 2); `listSentStateKeys` from `lib/notification-log-repository.ts` (Task 3); `showNotification`, `clearAppBadge` from `lib/notifications.ts`; `playNotificationSound` from `lib/notification-sound.ts`.
- Produces: `AlertItem` interface gains `priority: NotificationPriority` and `stateKey: string` fields; `useOverdueAlerts` (kept as the exported name — it now covers all three priorities, not just overdue, but renaming would touch every call site's import for no behavioral gain) skips any item whose `` `${entityType}:${entityId}:${stateKey}` `` already appears in the server's `notification_log`, so it never duplicates a push the sweep already delivered. Consumed by Task 14 (`HomePage`).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/use-overdue-alerts.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const mockShowNotification = vi.fn();
const mockClearAppBadge = vi.fn();
const mockPlaySound = vi.fn();
const mockListSentStateKeys = vi.fn();

vi.mock('./notifications', () => ({ showNotification: mockShowNotification, clearAppBadge: mockClearAppBadge }));
vi.mock('./notification-sound', () => ({ playNotificationSound: mockPlaySound }));
vi.mock('./notification-log-repository', () => ({ listSentStateKeys: mockListSentStateKeys }));

import { useOverdueAlerts, type AlertItem } from './use-overdue-alerts';

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mockListSentStateKeys.mockResolvedValue(new Set());
});

describe('useOverdueAlerts', () => {
  it('shows an in-app notification for a new item not yet sent by the server', async () => {
    const items: AlertItem[] = [
      { id: 'bill:b1:overdue', title: 'Overdue: Electricity Bill', body: '₱84.50 was due', priority: 'critical', entityType: 'bill', entityId: 'b1', stateKey: 'overdue' },
    ];

    renderHook(() => useOverdueAlerts(items));

    await waitFor(() => expect(mockShowNotification).toHaveBeenCalledWith('Overdue: Electricity Bill', { body: '₱84.50 was due' }));
  });

  it('does not show an in-app notification for an item already in the server log', async () => {
    mockListSentStateKeys.mockResolvedValue(new Set(['bill:b1:overdue']));
    const items: AlertItem[] = [
      { id: 'bill:b1:overdue', title: 'Overdue: Electricity Bill', body: '₱84.50 was due', priority: 'critical', entityType: 'bill', entityId: 'b1', stateKey: 'overdue' },
    ];

    renderHook(() => useOverdueAlerts(items));

    await waitFor(() => expect(mockListSentStateKeys).toHaveBeenCalled());
    expect(mockShowNotification).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/use-overdue-alerts.test.ts`
Expected: FAIL — `AlertItem` doesn't have `priority`/`entityType`/`entityId`/`stateKey` fields yet, and the hook doesn't call `listSentStateKeys`

- [ ] **Step 3: Rewrite the hook**

```typescript
// lib/use-overdue-alerts.ts
'use client';

import { useEffect, useRef } from 'react';
import { showNotification, clearAppBadge } from './notifications';
import { playNotificationSound } from './notification-sound';
import { listSentStateKeys } from './notification-log-repository';
import type { NotificationPriority } from './notification-priority';

export interface AlertItem {
  id: string;
  title: string;
  body: string;
  priority: NotificationPriority;
  entityType: 'bill' | 'reminder';
  entityId: string;
  stateKey: string;
}

interface UseOverdueAlertsOptions {
  soundEnabled?: boolean;
}

const STORAGE_KEY = 'kb-personals-notified-alert-ids';

function loadNotifiedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveNotifiedIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // localStorage may be unavailable (private browsing, quota) — non-critical.
  }
}

export function useOverdueAlerts(items: AlertItem[], options: UseOverdueAlertsOptions = {}) {
  const { soundEnabled = true } = options;
  const notifiedIdsRef = useRef<Set<string> | null>(null);
  if (notifiedIdsRef.current === null) {
    notifiedIdsRef.current = loadNotifiedIds();
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const notifiedIds = notifiedIdsRef.current!;
      const sentByServer = await listSentStateKeys();
      if (cancelled) return;

      const newItems = items.filter((item) => {
        const serverKey = `${item.entityType}:${item.entityId}:${item.stateKey}`;
        return !notifiedIds.has(item.id) && !sentByServer.has(serverKey);
      });

      if (newItems.length === 0) {
        clearAppBadge();
        return;
      }

      for (const item of newItems) {
        showNotification(item.title, { body: item.body });
        notifiedIds.add(item.id);
      }
      saveNotifiedIds(notifiedIds);

      if (soundEnabled) {
        playNotificationSound();
      }

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(200);
      }

      if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
        (navigator as Navigator & { setAppBadge: (count: number) => Promise<void> })
          .setAppBadge(newItems.length)
          .catch(() => {});
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [items, soundEnabled]);

  return { activeAlertCount: items.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/use-overdue-alerts.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/use-overdue-alerts.ts lib/use-overdue-alerts.test.ts
git commit -m "feat: extend in-app fallback to cover urgent/reminder priorities and skip server-sent items"
```

---

### Task 14: Wire HomePage — push subscribe, extended fallback, all three priorities

**Files:**
- Modify: `app/(shell)/page.tsx`
- Modify: `app/(shell)/page.test.tsx` (check `ls "app/(shell)/page.test.tsx"` first — update whichever assertions reference the old `AlertItem`/prop shapes)

**Interfaces:**
- Consumes: `subscribeToPush`, `getPushSubscriptionState` from `lib/push-subscription.ts` (Task 5); `getPreferences`, `upsertPreferences` from `lib/notification-preferences-repository.ts` (Task 4); updated `NotificationSettings` props (Task 12); updated `AlertItem`/`useOverdueAlerts` (Task 13); `getOverdueBills`, `getBillsDueWithinDays`, `getUpcomingReminders` from `lib/dashboard-selectors.ts` (existing).

- [ ] **Step 1: Update the page**

```tsx
// app/(shell)/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useCalendarEvents } from '@/lib/use-calendar-events';
import { useBudget } from '@/lib/use-budget';
import { useBills } from '@/lib/use-bills';
import { useReminders } from '@/lib/use-reminders';
import { useIsMounted } from '@/lib/use-is-mounted';
import { getOverdueBills, getBillsDueWithinDays, getUpcomingReminders } from '@/lib/dashboard-selectors';
import { toISODateString } from '@/lib/date-utils';
import { isNotificationSupported, requestNotificationPermission } from '@/lib/notifications';
import { subscribeToPush, isPushSupported } from '@/lib/push-subscription';
import { getPreferences, upsertPreferences, type NotificationPreferences } from '@/lib/notification-preferences-repository';
import { useOverdueAlerts, type AlertItem } from '@/lib/use-overdue-alerts';
import type { NotificationPriority } from '@/lib/notification-priority';
import { AlertsBanner } from '@/components/dashboard/AlertsBanner';
import { NotificationSettings, type NotificationPermissionState } from '@/components/dashboard/NotificationSettings';
import { DashboardCalendarCard } from '@/components/dashboard/DashboardCalendarCard';
import { WeeklyBillsPanel } from '@/components/dashboard/WeeklyBillsPanel';
import { SpendingSnapshot } from '@/components/dashboard/SpendingSnapshot';
import { RemindersPanel } from '@/components/dashboard/RemindersPanel';
import { QuickActionsRow } from '@/components/dashboard/QuickActionsRow';

export default function HomePage() {
  const { totals, error: budgetError } = useBudget();
  const { bills, error: billsError, togglePaid } = useBills();
  const { reminders, error: remindersError } = useReminders();
  const { events, getEventsForDate } = useCalendarEvents(bills, reminders);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [requestedPermission, setRequestedPermission] = useState<NotificationPermission | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    quietHoursStart: null,
    quietHoursEnd: null,
    soundEnabled: true,
    enabledPriorities: ['critical', 'urgent', 'reminder'],
  });
  const isMounted = useIsMounted();

  useEffect(() => {
    if (!isMounted) return;
    getPreferences().then(setPreferences);
  }, [isMounted]);

  const permission: NotificationPermissionState =
    requestedPermission ??
    (isMounted ? (isNotificationSupported() ? Notification.permission : isPushSupported() ? 'default' : 'unsupported') : 'default');

  const now = new Date();
  const paidBillIds = new Set(bills.filter((bill) => bill.paid).map((bill) => bill.id));
  const actionableEvents = events.filter((event) => event.type !== 'bill' || !paidBillIds.has(event.id));
  const overdueBills = getOverdueBills(actionableEvents, now);
  const weeklyBills = getBillsDueWithinDays(actionableEvents, 7, now);
  const dueSoonBills = getBillsDueWithinDays(actionableEvents, 3, now);
  const upcomingReminders = getUpcomingReminders(events, 3, now);
  const dueTodayReminders = events.filter((e) => e.type === 'reminder' && e.date === toISODateString(now));

  const alertItems: AlertItem[] = [
    ...overdueBills.map((bill) => ({
      id: `bill:${bill.id}:overdue`,
      title: `Overdue: ${bill.title}`,
      body: bill.amount !== undefined ? `₱${bill.amount.toFixed(2)} was due` : 'Payment is overdue',
      priority: 'critical' as NotificationPriority,
      entityType: 'bill' as const,
      entityId: bill.id,
      stateKey: 'overdue',
    })),
    ...dueSoonBills.map((bill) => ({
      id: `bill:${bill.id}:due_soon:${bill.date}`,
      title: `Due soon: ${bill.title}`,
      body: bill.amount !== undefined ? `₱${bill.amount.toFixed(2)} due ${bill.date}` : `Due ${bill.date}`,
      priority: 'urgent' as NotificationPriority,
      entityType: 'bill' as const,
      entityId: bill.id,
      stateKey: `due_soon:${bill.date}`,
    })),
    ...dueTodayReminders.map((reminder) => ({
      id: `reminder:${reminder.id}:due:${reminder.date}`,
      title: `Reminder: ${reminder.title}`,
      body: `Due ${reminder.date}`,
      priority: 'reminder' as NotificationPriority,
      entityType: 'reminder' as const,
      entityId: reminder.id,
      stateKey: `due:${reminder.date}`,
    })),
  ];
  useOverdueAlerts(alertItems, { soundEnabled: preferences.soundEnabled });

  async function handleRequestPermission() {
    const result = await requestNotificationPermission();
    setRequestedPermission(result);
    if (result === 'granted') {
      await subscribeToPush();
    }
  }

  function handleToggleSound() {
    const next = { ...preferences, soundEnabled: !preferences.soundEnabled };
    setPreferences(next);
    upsertPreferences(next);
  }

  function handleQuietHoursChange(start: string | null, end: string | null) {
    const next = { ...preferences, quietHoursStart: start, quietHoursEnd: end };
    setPreferences(next);
    upsertPreferences(next);
  }

  function handleTogglePriority(priority: NotificationPriority) {
    const enabled = preferences.enabledPriorities.includes(priority)
      ? preferences.enabledPriorities.filter((p) => p !== priority)
      : [...preferences.enabledPriorities, priority];
    const next = { ...preferences, enabledPriorities: enabled };
    setPreferences(next);
    upsertPreferences(next);
  }

  const error = budgetError ?? billsError ?? remindersError;

  return (
    <div data-testid="home-page" className="flex flex-col gap-6 px-4 pb-24 pt-4">
      {isMounted && (
        <>
          {error && <p className="text-sm text-status-critical">{error}</p>}
          <AlertsBanner overdueBills={overdueBills} referenceDate={now} />
          <NotificationSettings
            permission={permission}
            onRequestPermission={handleRequestPermission}
            soundEnabled={preferences.soundEnabled}
            onToggleSound={handleToggleSound}
            quietHoursStart={preferences.quietHoursStart}
            quietHoursEnd={preferences.quietHoursEnd}
            onQuietHoursChange={handleQuietHoursChange}
            enabledPriorities={preferences.enabledPriorities}
            onTogglePriority={handleTogglePriority}
          />
          <DashboardCalendarCard
            getEventsForDate={getEventsForDate}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
          <WeeklyBillsPanel bills={weeklyBills} referenceDate={now} onMarkPaid={togglePaid} />
          <SpendingSnapshot budgeted={totals.budgeted} spent={totals.spent} remaining={totals.remaining} />
          <RemindersPanel reminders={upcomingReminders} referenceDate={now} />
          <QuickActionsRow />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update the page test's NotificationSettings expectations**

Run `ls "app/(shell)/page.test.tsx"` first. If it exists and asserts on
`NotificationSettings` props/rendering, update it to pass/expect the new props from
Task 12 (mirror the pattern already used in `NotificationSettings.test.tsx`'s
`baseProps`). If it mocks `lib/push-subscription` or
`lib/notification-preferences-repository`, add those mocks now (both modules make
network calls that must not run unmocked in tests):

```typescript
vi.mock('@/lib/push-subscription', () => ({
  subscribeToPush: vi.fn().mockResolvedValue(true),
  isPushSupported: vi.fn().mockReturnValue(true),
}));
vi.mock('@/lib/notification-preferences-repository', () => ({
  getPreferences: vi.fn().mockResolvedValue({
    quietHoursStart: null,
    quietHoursEnd: null,
    soundEnabled: true,
    enabledPriorities: ['critical', 'urgent', 'reminder'],
  }),
  upsertPreferences: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/notification-log-repository', () => ({
  listSentStateKeys: vi.fn().mockResolvedValue(new Set()),
}));
```

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — all existing tests plus the new/updated ones from this and prior tasks

- [ ] **Step 4: Commit**

```bash
git add "app/(shell)/page.tsx" "app/(shell)/page.test.tsx"
git commit -m "feat: wire push subscription, preferences, and all three alert priorities into HomePage"
```

---

### Task 15: Deep link — Bills page `?open=<id>`

**Files:**
- Modify: `app/(shell)/bills/page.tsx`
- Modify: `app/(shell)/bills/page.test.tsx` (check it exists first: `ls "app/(shell)/bills/page.test.tsx"`)

**Interfaces:**
- Consumes: `useSearchParams` from `next/navigation`; existing `openEditForm(bill)` and `bills` array from `useBills()`.

- [ ] **Step 1: Write the failing test**

Add to `app/(shell)/bills/page.test.tsx` (or create it following the pattern of
`app/(shell)/reminders/page.test.tsx` if bills has no test file yet — check with `ls`):

```tsx
it('opens the edit form for the bill named in the ?open= query param', async () => {
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams('open=bill-1') as never);
  // render with a fixture bill of id 'bill-1' already present via the mocked useBills()
  render(<BillsPage />);
  await waitFor(() => expect(screen.getByTestId('bill-form')).toHaveAttribute('data-open', 'true'));
});
```

Adapt the exact mock shape to however `useBills`/`BillForm` are already mocked
elsewhere in this test file — follow the file's existing conventions rather than
introducing a new mocking style.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/(shell)/bills/page.test.tsx"`
Expected: FAIL — `?open=` isn't read yet

- [ ] **Step 3: Add search-param handling**

```tsx
// app/(shell)/bills/page.tsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { MonthGrid } from '@/components/calendar/MonthGrid';
import { DayDetailPanel } from '@/components/calendar/DayDetailPanel';
import { useCalendarEvents } from '@/lib/use-calendar-events';
import { useIsMounted } from '@/lib/use-is-mounted';
import { useBills } from '@/lib/use-bills';
import { useReminders } from '@/lib/use-reminders';
import { useCategories } from '@/lib/use-categories';
import { BillsListView } from '@/components/bills/BillsListView';
import { BillForm } from '@/components/bills/BillForm';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { Button } from '@/components/ui/button';
import type { Bill } from '@/lib/bills-types';

function BillsPageContent() {
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const isMounted = useIsMounted();
  const searchParams = useSearchParams();

  const { bills, loading, error, createBill, updateBill, deleteBill, togglePaid } = useBills();
  const { reminders } = useReminders();
  const { getEventsForDate } = useCalendarEvents(bills, reminders);
  const { activeCategories } = useCategories();

  const [formOpen, setFormOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<(Bill & { categoryId: string }) | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Bill | null>(null);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

  useEffect(() => {
    if (deepLinkHandled || loading) return;
    const openId = searchParams.get('open');
    if (!openId) return;
    const target = bills.find((bill) => bill.id === openId);
    if (target) {
      setEditingBill(target as Bill & { categoryId: string });
      setFormOpen(true);
    }
    setDeepLinkHandled(true);
  }, [deepLinkHandled, loading, searchParams, bills]);

  function openAddForm() {
    setEditingBill(undefined);
    setFormOpen(true);
  }

  function openEditForm(bill: Bill) {
    setEditingBill(bill as Bill & { categoryId: string });
    setFormOpen(true);
  }

  async function handleSubmit(input: { title: string; categoryId: string; amount: number; dueDate: string; recurrence: Bill['recurrence'] }) {
    if (editingBill) {
      await updateBill(editingBill.id, input);
    } else {
      await createBill(input);
    }
  }

  return (
    <div data-testid="bills-page" className="flex flex-col gap-4 px-4 pb-24 pt-4">
      <div className="flex items-center justify-between">
        <div data-testid="bills-view-toggle" className="flex gap-2">
          <Button
            data-testid="bills-view-list"
            variant={view === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('list')}
          >
            List
          </Button>
          <Button
            data-testid="bills-view-calendar"
            variant={view === 'calendar' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('calendar')}
          >
            Calendar
          </Button>
        </div>
        <Button size="sm" onClick={openAddForm}>
          <Plus className="h-4 w-4" />
          Add Bill
        </Button>
      </div>
      {error && <p className="text-sm text-status-critical">{error}</p>}
      {isMounted && loading && (
        <p data-testid="bills-loading" className="text-center text-sm text-neutral-400">
          Loading bills…
        </p>
      )}
      {isMounted &&
        !loading &&
        (view === 'list' ? (
          <BillsListView
            bills={bills}
            onTogglePaid={togglePaid}
            referenceDate={new Date()}
            onEdit={openEditForm}
            onDelete={setDeleteTarget}
          />
        ) : (
          <>
            <MonthGrid getEventsForDate={getEventsForDate} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            <DayDetailPanel date={selectedDate} events={getEventsForDate(selectedDate)} />
          </>
        ))}

      <BillForm
        key={`${editingBill?.id ?? 'new'}-${formOpen}`}
        open={formOpen}
        onOpenChange={setFormOpen}
        categories={activeCategories}
        initialBill={editingBill}
        onSubmit={handleSubmit}
      />
      {deleteTarget && (
        <ConfirmDeleteDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title={`Delete ${deleteTarget.title}?`}
          description="This can't be undone."
          onConfirm={() => deleteBill(deleteTarget.id)}
        />
      )}
    </div>
  );
}

export default function BillsPage() {
  return (
    <Suspense fallback={null}>
      <BillsPageContent />
    </Suspense>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "app/(shell)/bills/page.test.tsx"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/(shell)/bills/page.tsx" "app/(shell)/bills/page.test.tsx"
git commit -m "feat: deep-link ?open=<id> to the Bills edit form"
```

---

### Task 16: Deep link — Reminders page `?open=<id>`

**Files:**
- Modify: `app/(shell)/reminders/page.tsx`
- Modify: `app/(shell)/reminders/page.test.tsx`

**Interfaces:**
- Consumes: `useSearchParams` from `next/navigation`; existing `openEditForm(reminder)` and `reminders` array from `useReminders()`.

- [ ] **Step 1: Write the failing test**

Add to `app/(shell)/reminders/page.test.tsx`, following that file's existing mocking
conventions for `useReminders`/`ReminderForm`:

```tsx
it('opens the edit form for the reminder named in the ?open= query param', async () => {
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams('open=reminder-1') as never);
  render(<RemindersPage />);
  await waitFor(() => expect(screen.getByTestId('reminder-form')).toHaveAttribute('data-open', 'true'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/(shell)/reminders/page.test.tsx"`
Expected: FAIL — `?open=` isn't read yet

- [ ] **Step 3: Add search-param handling**

```tsx
// app/(shell)/reminders/page.tsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useReminders } from '@/lib/use-reminders';
import { RemindersListView } from '@/components/reminders/RemindersListView';
import { ReminderForm } from '@/components/reminders/ReminderForm';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { Button } from '@/components/ui/button';
import { useIsMounted } from '@/lib/use-is-mounted';
import type { Reminder } from '@/lib/reminders-types';

function RemindersPageContent() {
  const isMounted = useIsMounted();
  const searchParams = useSearchParams();
  const { reminders, loading, error, createReminder, updateReminder, deleteReminder, toggleComplete, snooze } = useReminders();

  const [formOpen, setFormOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Reminder | null>(null);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

  useEffect(() => {
    if (deepLinkHandled || loading) return;
    const openId = searchParams.get('open');
    if (!openId) return;
    const target = reminders.find((reminder) => reminder.id === openId);
    if (target) {
      setEditingReminder(target);
      setFormOpen(true);
    }
    setDeepLinkHandled(true);
  }, [deepLinkHandled, loading, searchParams, reminders]);

  function openAddForm() {
    setEditingReminder(undefined);
    setFormOpen(true);
  }

  function openEditForm(reminder: Reminder) {
    setEditingReminder(reminder);
    setFormOpen(true);
  }

  async function handleSubmit(input: { title: string; category: string; dueDate: string; priority: Reminder['priority'] }) {
    if (editingReminder) {
      await updateReminder(editingReminder.id, input);
    } else {
      await createReminder(input);
    }
  }

  return (
    <div data-testid="reminders-page" className="flex flex-col gap-4 px-4 pb-24 pt-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openAddForm}>
          <Plus className="h-4 w-4" />
          Add Reminder
        </Button>
      </div>
      {error && <p className="text-sm text-status-critical">{error}</p>}
      {isMounted && loading && (
        <p data-testid="reminders-loading" className="text-center text-sm text-neutral-400">
          Loading reminders…
        </p>
      )}
      {isMounted && !loading && (
        <RemindersListView
          reminders={reminders}
          onToggleComplete={toggleComplete}
          onSnooze={snooze}
          referenceDate={new Date()}
          onEdit={openEditForm}
          onDelete={setDeleteTarget}
        />
      )}

      <ReminderForm
        key={`${editingReminder?.id ?? 'new'}-${formOpen}`}
        open={formOpen}
        onOpenChange={setFormOpen}
        initialReminder={editingReminder}
        onSubmit={handleSubmit}
      />
      {deleteTarget && (
        <ConfirmDeleteDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title={`Delete ${deleteTarget.title}?`}
          description="This can't be undone."
          onConfirm={() => deleteReminder(deleteTarget.id)}
        />
      )}
    </div>
  );
}

export default function RemindersPage() {
  return (
    <Suspense fallback={null}>
      <RemindersPageContent />
    </Suspense>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "app/(shell)/reminders/page.test.tsx"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/(shell)/reminders/page.tsx" "app/(shell)/reminders/page.test.tsx"
git commit -m "feat: deep-link ?open=<id> to the Reminders edit form"
```

---

### Task 17: Full automated suite + manual device test matrix

**Files:** none created — verification task.

- [ ] **Step 1: Run the full automated suite**

```bash
npx vitest run
npx tsc --noEmit
npx eslint .
```

Expected: all green. Fix any failures surfaced by the integration of Tasks 1–16 before
proceeding — most likely spot: `app/(shell)/page.test.tsx` and any other test file that
renders `HomePage`/`BillsPage`/`RemindersPage` and doesn't yet mock the new modules from
Task 14's Step 2.

- [ ] **Step 2: Manual device matrix**

Execute each row for real, on real devices — this is not optional per the spec's
Testing section, and none of it is achievable by an automated test:

| Scenario | Steps | Pass condition |
|---|---|---|
| iOS Safari PWA, locked screen | Install to home screen (Share → Add to Home Screen) on iOS 16.4+, enable notifications, lock the phone, trigger a sweep (mark a bill overdue, wait for or manually invoke `notify-sweep`) | Notification appears on the lock screen with correct title/amount |
| iOS Safari PWA, backgrounded | Same setup, app open then backgrounded (home button/swipe away without force-quit) | Notification appears in Notification Center |
| iOS Safari PWA, fully closed | Force-quit the app, trigger a sweep | Notification still arrives (push works independent of app process) |
| Android Chrome PWA, locked/backgrounded/closed | Same three states as iOS, installed as PWA | Notification arrives in all three states with vibration |
| Desktop Chrome/Edge, backgrounded | Grant permission, background the browser window, trigger a sweep | Notification arrives in the OS notification center |
| Desktop Chrome/Edge, browser closed | Fully quit the browser, trigger a sweep | Notification arrives (OS-level push service delivers independent of the browser process, per Chrome's/Edge's background push service) |
| Tap-to-deep-link | Tap a delivered bill notification | App opens/focuses directly on `/bills` with the relevant bill's edit form open |
| Permission denied fallback | Deny notification permission, then let a bill go overdue while the app is open in the foreground | In-app toast/alert + chime + vibration fire (Task 13's fallback path) |
| Grouping | Let 2+ bills become overdue in the same sweep window | One grouped notification ("N bills overdue: ₱X total"), not N separate notifications |
| Quiet hours | Set quiet hours covering the current time, let a reminder become due | Reminder notification does not arrive until quiet hours end; a simultaneously overdue bill still arrives immediately |
| Dedupe | Let the sweep run twice in a row for the same overdue bill (Task 9 Step 2's curl re-run, or wait two 15-minute cycles) | Only one notification total, not one per sweep |

- [ ] **Step 3: Record results and fix any failures found**

For any row that fails, return to the relevant task above, fix the root cause, and
re-run both the automated suite and that specific manual row before considering this
plan complete.
