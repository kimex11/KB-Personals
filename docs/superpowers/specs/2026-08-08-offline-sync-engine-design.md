# Offline Sync Engine (Phase 1 of Hybrid/Offline PWA Support)

Status: Approved (pending spec review)
Date: 2026-08-08

## Problem

The app has no client-side data store. Every repository function (`listBills`,
`createBill`, `closeBillCycle`, etc.) calls Supabase directly with no fallback — offline,
every screen goes blank or errors, and any in-progress write is simply lost. `public/sw.js`
deliberately only caches static build assets (`_next/static`, icons), never API/data
responses, so there is currently zero mechanism for reading stale-but-usable data or for
queuing a write to retry later.

Goal: full offline read/write for bills and reminders — browse last-known data with no
network, create/edit/delete/pay/skip while offline, and have those changes sync
automatically and transparently once connectivity returns.

This is Phase 1 of a three-phase project (offline sync engine, proven on Bills +
Reminders → roll the same pattern out to Categories/Accounts/Budget → Receipts, which
need a different strategy for offline image capture/upload). This spec covers Phase 1
only.

## Architecture

A generic, entity-agnostic module under `lib/offline/` that any repository can plug
into — Bills and Reminders are the first two, but nothing in this layer is bills- or
reminders-specific.

```
User action (read or write)
        │
        ▼
useBills / useReminders
  read:  try live Supabase call
           success → cache the result, return it
           network failure → return getCachedList() instead of erroring
  write: try live Supabase call (create/update/delete/togglePaid/skipCycle/
         createRecurringBill/...)
           success → proceed as today (refresh from server)
           network failure → enqueueMutation(...) + apply an optimistic local update
                              so the UI reflects the change immediately
        │
        ▼ (on reconnect: 'online' event, or the next request that succeeds)
processQueue()
  replay each queued mutation, in order, against the real repository function
    success → remove from queue
    failure (e.g. row was deleted server-side) → drop from queue, surface a
              non-blocking toast, continue with the rest of the queue
  after the queue drains → refetch the full list from the server and replace the
    cache (this is also what reconciles temporary client-generated ids away --
    the refetched list only ever contains real server rows)
```

### Modules

- **`lib/offline/db.ts`** — thin wrapper around `idb` (the ~1.2kb Promise wrapper
  around native IndexedDB — matches this project's preference for minimal dependencies,
  e.g. the notification chime is synthesized via Web Audio rather than shipping an audio
  file). Opens one IndexedDB database, `kb-personals-offline`, with object stores:
  `bills`, `reminders`, `mutation_queue`.
- **`lib/offline/cache.ts`** — `cacheList<T>(storeName, items: T[]): Promise<void>`,
  `getCachedList<T>(storeName): Promise<T[]>`. Each call replaces the entire store's
  contents (simple, no per-row diffing — these lists are small).
- **`lib/offline/queue.ts`** — `enqueueMutation(entry: { entity: 'bill' | 'reminder';
  operation: string; args: unknown[] }): Promise<void>`, `getQueue(): Promise<QueueEntry[]>`,
  `removeFromQueue(id: string): Promise<void>`. Queue entries are plain serializable
  data (an entity name, an operation name, and its arguments) — not functions, since
  functions cannot be stored in IndexedDB. `id` is a `crypto.randomUUID()` assigned at
  enqueue time so entries can be individually removed after replay.
- **`lib/offline/sync-engine.ts`** — `processQueue(refetchAndCache: () => Promise<void>):
  Promise<void>`. Holds a lookup table `{ bill: { createBill, updateBill, deleteBill,
  closeBillCycle, ... }, reminder: { ... } }` mapping `entity` + `operation` to the real
  repository function, imported directly (this file is the one place that imports both
  `bills-repository.ts` and `reminders-repository.ts`, so the generic queue/cache modules
  stay entity-agnostic). Replays entries via `getQueue()`, calls the looked-up function
  with the stored `args`, removes successes, drops and reports failures, then calls
  `refetchAndCache()` once at the end.
- **`lib/offline/connectivity.ts`** — `useOnlineStatus(): boolean`. Seeds from
  `navigator.onLine`, updates on the `online`/`offline` window events. Treated as a
  hint that triggers a sync attempt, not as ground truth for whether a request will
  succeed — actual request failures are what really drive the cache-fallback and
  enqueue behavior, matching how real-world flaky connections behave (`navigator.onLine`
  can report `true` while requests still fail).

### Wiring into `useBills` / `useReminders`

Every existing repository call in these two hooks gets wrapped the same way: attempt the
live call; on a network-shaped failure (the fetch itself rejects, as opposed to a
Supabase error response like a constraint violation), fall back for reads or enqueue for
writes. A `TypeError: Failed to fetch` (or equivalent) is what distinguishes "we're
offline" from "the server rejected this," so only that class of error triggers the
offline path — a real validation/constraint error from Supabase should still surface
normally.

Optimistic writes: a queued `createBill` gets a temporary id
(`crypto.randomUUID()`) so the new row can render in the list immediately; queued
`update`/`delete`/`closeBillCycle`/etc. apply directly to the matching cached row by its
real id. All optimistic state is held in the same in-memory `bills`/`reminders` array the
hooks already manage — no separate "pending" data structure — with a `pendingSync:
boolean` field added so the UI can show a subtle sync-pending indicator per row.

## Data Model

No Supabase schema changes — this phase is entirely client-side (IndexedDB). No new
migration.

## Testing

- `lib/offline/db.test.ts`, `cache.test.ts`, `queue.test.ts` — run against
  `fake-indexeddb` (new dev dependency; the standard in-memory IndexedDB polyfill used to
  test code built on `idb`), covering store creation, list replace-on-cache, and
  enqueue/get/remove.
- `lib/offline/sync-engine.test.ts` — mocked repository lookup table, verifying: replay
  order is preserved, a successful replay removes its entry, a failed replay drops its
  entry without blocking the rest, and `refetchAndCache` runs exactly once after the
  queue drains (including when the queue was empty to begin with — a no-op case that
  still needs to re-sync).
- `lib/offline/connectivity.test.ts` — `useOnlineStatus()` reflects `navigator.onLine`
  and updates on `online`/`offline` events.
- `lib/use-bills.test.ts` / `lib/use-reminders.test.ts` — extended with: a network-error
  list fetch falls back to cached data; a network-error mutation enqueues and applies an
  optimistic update instead of surfacing an error.

## Open Questions / Risks

- **What counts as "network failure" vs. "real error"** is inferred from the error
  shape (`TypeError` / `Failed to fetch` from a rejected `fetch`) rather than an explicit
  Supabase offline signal — this is the standard way to detect this class of failure in
  browsers, but if Supabase's client ever wraps network errors differently, this
  detection point needs revisiting.
- **Storage quota**: IndexedDB has browser-enforced quotas, but bills/reminders lists are
  small (dozens to low hundreds of rows) — not a practical concern for this phase. Will
  matter more in the Receipts phase (image blobs).
- **Multi-tab**: if the app is open in two tabs while offline, both queue independently;
  on reconnect, whichever tab's `processQueue()` runs first wins the replay order for
  that tab's entries, and the other tab's `getQueue()` may briefly reflect a mix of
  already-replayed and pending entries until IndexedDB change events (not implemented in
  this phase) would otherwise reconcile it. Not addressed here — acceptable for a
  single-admin app; would need a `BroadcastChannel`-based lock to fully solve.
