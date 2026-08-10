# Offline Sync Engine (Phase 1: Bills + Reminders) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bills and reminders work fully offline — browse last-known data with no network, create/edit/delete/pay/skip while offline, and have those changes replay automatically once connectivity returns.

**Architecture:** A generic `lib/offline/` module (IndexedDB cache + mutation queue + sync engine + connectivity hook), entity-agnostic, wired into `useBills`/`useReminders`. Every read falls back to the IndexedDB cache on a network-shaped failure; every write that fails the same way is queued and applied optimistically to local state, then replayed in order on reconnect.

**Tech Stack:** `idb` (thin Promise wrapper around native IndexedDB), `fake-indexeddb` (in-memory IndexedDB polyfill for tests), React, vitest + Testing Library.

## Global Constraints

- Every queued mutation is plain serializable data — `{ id, entity, operation, args, sequence }` — never a function reference, since IndexedDB cannot store functions. `sequence` is an in-memory incrementing counter, not a timestamp — `db.getAll()` on IndexedDB returns rows ordered by primary key (a random UUID here), **not** insertion order, so an explicit ordering field is required; a timestamp risks ties within the same millisecond.
- "Network failure" (triggers cache-fallback / enqueue) is distinguished from "real error" (Supabase constraint violation, etc.) by `err instanceof TypeError && /fetch/i.test(err.message)` — the standard shape of a rejected `fetch()`. Only that class of error takes the offline path; everything else surfaces exactly as it does today.
- **Deviation from the design spec**: `processQueue` returns immediately (no `refetchAndCache` call) when the queue is empty, rather than always refetching once. The spec's original wording ("even when the queue was empty ... still needs to re-sync") would double-fire the hooks' existing mount-time `refresh()` on every render for the common case (queue empty, which is nearly always), breaking every existing call-count assertion in `use-bills.test.ts`/`use-reminders.test.ts`. Skipping the refetch when there is nothing to reconcile is behaviorally equivalent and avoids that collision.
- **Deviation from the design spec, scope cut**: recurring cycle-close operations (`closeBillCycle`/`closeReminderCycle`, and `createRecurringBill`/`createRecurringReminder`) queue and optimistically flip the current row's `paid`/`completed`/`skipped` flag, but do **not** locally preview the next generated cycle while offline — computing that requires the series' frequency rule, which isn't loaded into these list hooks. The next cycle appears once the queued operation replays online and the subsequent refetch runs. This is a deliberate, documented cut, not a bug.
- **Scope cut**: `useBills`/`useReminders` expose `pendingSyncIds: Set<string>` so a row currently waiting to sync is identifiable, but no visual "pending sync" badge/indicator is built on `BillRow`/`ReminderRow` in this plan — that's UI wiring left for a fast-follow, the same way earlier phases shipped a capability at the hook/repository level before wiring its row-level UI treatment.
- Follow existing repository/hook conventions in this codebase: manual row interfaces, `'use client'` hooks, the existing `runMutation`-style error handling in `use-bills.ts`/`use-reminders.ts`.
- No Supabase schema changes in this phase — everything here is client-side (IndexedDB).

---

### Task 1: Install dependencies and register the test polyfill

**Files:**
- Modify: `package.json` (via install commands)
- Modify: `vitest.setup.ts`

**Interfaces:**
- Produces: `idb` available for import at runtime; `indexedDB`/`IDBKeyRange` available as globals in every vitest test via `fake-indexeddb/auto`, so no individual test file needs to import the polyfill itself.

- [ ] **Step 1: Install the dependencies**

```bash
npm install idb
npm install --save-dev fake-indexeddb
```

- [ ] **Step 2: Register the polyfill globally for tests**

```typescript
// vitest.setup.ts
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';

if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList;
  }

  if (!('ResizeObserver' in window)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    // @ts-expect-error test polyfill
    window.ResizeObserver = ResizeObserverStub;
  }
}
```

- [ ] **Step 3: Verify the polyfill loads without breaking the existing suite**

Run: `npx vitest run`
Expected: same pass count as before this change (no test yet uses IndexedDB, this just confirms the global setup doesn't error)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vitest.setup.ts
git commit -m "chore: add idb and fake-indexeddb for the offline sync engine"
```

---

### Task 2: IndexedDB database wrapper

**Files:**
- Create: `lib/offline/db.ts`
- Test: `lib/offline/db.test.ts`

**Interfaces:**
- Produces: `QueueEntry` interface (`{ id: string, entity: 'bill' | 'reminder', operation: string, args: unknown[], sequence: number }`), `getDb(): Promise<IDBPDatabase>`, `resetDbForTests(): void`. Consumed by every other `lib/offline/*` module and by their tests (to reset state between tests).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/offline/db.test.ts
import { afterEach, describe, expect, it } from 'vitest';
import { getDb, resetDbForTests } from './db';

afterEach(async () => {
  resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kb-personals-offline');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

describe('getDb', () => {
  it('creates bills, reminders, and mutation_queue object stores', async () => {
    const db = await getDb();
    expect(Array.from(db.objectStoreNames)).toEqual(
      expect.arrayContaining(['bills', 'reminders', 'mutation_queue'])
    );
  });

  it('returns the same database instance on repeated calls', async () => {
    const first = await getDb();
    const second = await getDb();
    expect(first).toBe(second);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/offline/db.test.ts`
Expected: FAIL with "Cannot find module './db'"

- [ ] **Step 3: Write the implementation**

```typescript
// lib/offline/db.ts
import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'kb-personals-offline';
const DB_VERSION = 1;

export interface QueueEntry {
  id: string;
  entity: 'bill' | 'reminder';
  operation: string;
  args: unknown[];
  sequence: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('bills')) db.createObjectStore('bills', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('reminders')) db.createObjectStore('reminders', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('mutation_queue')) db.createObjectStore('mutation_queue', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

export function resetDbForTests(): void {
  dbPromise = null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/offline/db.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/offline/db.ts lib/offline/db.test.ts
git commit -m "feat: add IndexedDB database wrapper for offline storage"
```

---

### Task 3: List cache

**Files:**
- Create: `lib/offline/cache.ts`
- Test: `lib/offline/cache.test.ts`

**Interfaces:**
- Consumes: `getDb` from `lib/offline/db.ts` (Task 2).
- Produces: `cacheList<T extends { id: string }>(storeName: 'bills' | 'reminders', items: T[]): Promise<void>`, `getCachedList<T>(storeName: 'bills' | 'reminders'): Promise<T[]>`. Consumed by Task 9/10 (`use-bills.ts`/`use-reminders.ts`).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/offline/cache.test.ts
import { afterEach, describe, expect, it } from 'vitest';
import { resetDbForTests } from './db';
import { cacheList, getCachedList } from './cache';

afterEach(async () => {
  resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kb-personals-offline');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

interface TestItem {
  id: string;
  value: string;
}

describe('cacheList / getCachedList', () => {
  it('stores and retrieves a list', async () => {
    await cacheList<TestItem>('bills', [
      { id: '1', value: 'a' },
      { id: '2', value: 'b' },
    ]);
    const result = await getCachedList<TestItem>('bills');
    expect(result).toEqual([
      { id: '1', value: 'a' },
      { id: '2', value: 'b' },
    ]);
  });

  it('replaces the previous contents on re-cache', async () => {
    await cacheList<TestItem>('bills', [{ id: '1', value: 'a' }]);
    await cacheList<TestItem>('bills', [{ id: '2', value: 'b' }]);
    const result = await getCachedList<TestItem>('bills');
    expect(result).toEqual([{ id: '2', value: 'b' }]);
  });

  it('returns an empty array when nothing has been cached', async () => {
    const result = await getCachedList<TestItem>('reminders');
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/offline/cache.test.ts`
Expected: FAIL with "Cannot find module './cache'"

- [ ] **Step 3: Write the implementation**

```typescript
// lib/offline/cache.ts
import { getDb } from './db';

export async function cacheList<T extends { id: string }>(storeName: 'bills' | 'reminders', items: T[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(storeName, 'readwrite');
  await tx.store.clear();
  await Promise.all(items.map((item) => tx.store.put(item)));
  await tx.done;
}

export async function getCachedList<T>(storeName: 'bills' | 'reminders'): Promise<T[]> {
  const db = await getDb();
  return db.getAll(storeName);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/offline/cache.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/offline/cache.ts lib/offline/cache.test.ts
git commit -m "feat: add offline list cache"
```

---

### Task 4: Mutation queue

**Files:**
- Create: `lib/offline/queue.ts`
- Test: `lib/offline/queue.test.ts`

**Interfaces:**
- Consumes: `getDb`, `QueueEntry` from `lib/offline/db.ts` (Task 2).
- Produces: `enqueueMutation(entry: Omit<QueueEntry, 'id' | 'sequence'>): Promise<void>`, `getQueue(): Promise<QueueEntry[]>` (sorted by `sequence` ascending), `removeFromQueue(id: string): Promise<void>`. Consumed by Task 6 (`attempt-or-queue.ts`) and Task 7 (`sync-engine.ts`).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/offline/queue.test.ts
import { afterEach, describe, expect, it } from 'vitest';
import { resetDbForTests } from './db';
import { enqueueMutation, getQueue, removeFromQueue } from './queue';

afterEach(async () => {
  resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kb-personals-offline');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

describe('enqueueMutation / getQueue / removeFromQueue', () => {
  it('returns queued entries in insertion order', async () => {
    await enqueueMutation({ entity: 'bill', operation: 'createBill', args: [{ title: 'A' }] });
    await enqueueMutation({ entity: 'bill', operation: 'deleteBill', args: ['bill-1'] });
    const queue = await getQueue();
    expect(queue.map((e) => e.operation)).toEqual(['createBill', 'deleteBill']);
  });

  it('assigns each entry a unique id', async () => {
    await enqueueMutation({ entity: 'reminder', operation: 'createReminder', args: [{}] });
    await enqueueMutation({ entity: 'reminder', operation: 'createReminder', args: [{}] });
    const queue = await getQueue();
    expect(queue[0].id).not.toBe(queue[1].id);
  });

  it('removes an entry by id', async () => {
    await enqueueMutation({ entity: 'bill', operation: 'createBill', args: [{}] });
    const [entry] = await getQueue();
    await removeFromQueue(entry.id);
    expect(await getQueue()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/offline/queue.test.ts`
Expected: FAIL with "Cannot find module './queue'"

- [ ] **Step 3: Write the implementation**

```typescript
// lib/offline/queue.ts
import { getDb } from './db';
import type { QueueEntry } from './db';

let sequenceCounter = 0;

export async function enqueueMutation(entry: Omit<QueueEntry, 'id' | 'sequence'>): Promise<void> {
  const db = await getDb();
  const full: QueueEntry = { ...entry, id: crypto.randomUUID(), sequence: sequenceCounter++ };
  await db.put('mutation_queue', full);
}

export async function getQueue(): Promise<QueueEntry[]> {
  const db = await getDb();
  const all: QueueEntry[] = await db.getAll('mutation_queue');
  return all.sort((a, b) => a.sequence - b.sequence);
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('mutation_queue', id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/offline/queue.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/offline/queue.ts lib/offline/queue.test.ts
git commit -m "feat: add offline mutation queue"
```

---

### Task 5: Network-error detection

**Files:**
- Create: `lib/offline/network-error.ts`
- Test: `lib/offline/network-error.test.ts`

**Interfaces:**
- Produces: `isNetworkError(error: unknown): boolean`. Consumed by Task 6 (`attempt-or-queue.ts`) and Task 9/10 (`use-bills.ts`/`use-reminders.ts`'s read-fallback path).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/offline/network-error.test.ts
import { describe, expect, it } from 'vitest';
import { isNetworkError } from './network-error';

describe('isNetworkError', () => {
  it('returns true for a TypeError from a failed fetch', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('returns false for a generic Error', () => {
    expect(isNetworkError(new Error('constraint violation'))).toBe(false);
  });

  it('returns false for a non-Error value', () => {
    expect(isNetworkError('some string')).toBe(false);
  });

  it('returns false for a TypeError unrelated to fetch', () => {
    expect(isNetworkError(new TypeError('Cannot read properties of undefined'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/offline/network-error.test.ts`
Expected: FAIL with "Cannot find module './network-error'"

- [ ] **Step 3: Write the implementation**

```typescript
// lib/offline/network-error.ts
export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError && /fetch/i.test(error.message);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/offline/network-error.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/offline/network-error.ts lib/offline/network-error.test.ts
git commit -m "feat: add network-error detection for the offline sync engine"
```

---

### Task 6: Shared attempt-or-queue helper

**Files:**
- Create: `lib/offline/attempt-or-queue.ts`
- Test: `lib/offline/attempt-or-queue.test.ts`

**Interfaces:**
- Consumes: `enqueueMutation` from `lib/offline/queue.ts` (Task 4); `isNetworkError` from `lib/offline/network-error.ts` (Task 5); `QueueEntry` from `lib/offline/db.ts` (Task 2).
- Produces: `attemptOrQueue(entity: QueueEntry['entity'], operation: string, args: unknown[], liveCall: () => Promise<unknown>, onNetworkFailure: () => void): Promise<void>`. Consumed by Task 9/10 (`use-bills.ts`/`use-reminders.ts`'s write path).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/offline/attempt-or-queue.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetDbForTests } from './db';
import { getQueue } from './queue';
import { attemptOrQueue } from './attempt-or-queue';

afterEach(async () => {
  resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kb-personals-offline');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

describe('attemptOrQueue', () => {
  it('calls the live function directly and does not queue on success', async () => {
    const liveCall = vi.fn().mockResolvedValue(undefined);
    const onNetworkFailure = vi.fn();
    await attemptOrQueue('bill', 'createBill', [{ title: 'A' }], liveCall, onNetworkFailure);
    expect(liveCall).toHaveBeenCalled();
    expect(onNetworkFailure).not.toHaveBeenCalled();
    expect(await getQueue()).toEqual([]);
  });

  it('queues the mutation and calls onNetworkFailure when the live call fails with a network error', async () => {
    const liveCall = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const onNetworkFailure = vi.fn();
    await attemptOrQueue('bill', 'createBill', [{ title: 'A' }], liveCall, onNetworkFailure);
    expect(onNetworkFailure).toHaveBeenCalled();
    const queue = await getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ entity: 'bill', operation: 'createBill', args: [{ title: 'A' }] });
  });

  it('rethrows a non-network error without queuing', async () => {
    const liveCall = vi.fn().mockRejectedValue(new Error('constraint violation'));
    const onNetworkFailure = vi.fn();
    await expect(attemptOrQueue('bill', 'createBill', [{}], liveCall, onNetworkFailure)).rejects.toThrow(
      'constraint violation'
    );
    expect(onNetworkFailure).not.toHaveBeenCalled();
    expect(await getQueue()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/offline/attempt-or-queue.test.ts`
Expected: FAIL with "Cannot find module './attempt-or-queue'"

- [ ] **Step 3: Write the implementation**

```typescript
// lib/offline/attempt-or-queue.ts
import { enqueueMutation } from './queue';
import { isNetworkError } from './network-error';
import type { QueueEntry } from './db';

export async function attemptOrQueue(
  entity: QueueEntry['entity'],
  operation: string,
  args: unknown[],
  liveCall: () => Promise<unknown>,
  onNetworkFailure: () => void
): Promise<void> {
  try {
    await liveCall();
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    await enqueueMutation({ entity, operation, args });
    onNetworkFailure();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/offline/attempt-or-queue.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/offline/attempt-or-queue.ts lib/offline/attempt-or-queue.test.ts
git commit -m "feat: add shared attempt-live-or-queue-offline helper"
```

---

### Task 7: Connectivity hook

**Files:**
- Create: `lib/offline/connectivity.ts`
- Test: `lib/offline/connectivity.test.ts`

**Interfaces:**
- Produces: `useOnlineStatus(): boolean`. Consumed by Task 9/10 (`use-bills.ts`/`use-reminders.ts`).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/offline/connectivity.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnlineStatus } from './connectivity';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useOnlineStatus', () => {
  it('reflects navigator.onLine on mount', () => {
    vi.stubGlobal('navigator', { onLine: false });
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });

  it('updates to true on an online event', () => {
    vi.stubGlobal('navigator', { onLine: false });
    const { result } = renderHook(() => useOnlineStatus());
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });

  it('updates to false on an offline event', () => {
    vi.stubGlobal('navigator', { onLine: true });
    const { result } = renderHook(() => useOnlineStatus());
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/offline/connectivity.test.ts`
Expected: FAIL with "Cannot find module './connectivity'"

- [ ] **Step 3: Write the implementation**

```typescript
// lib/offline/connectivity.ts
'use client';

import { useEffect, useState } from 'react';

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/offline/connectivity.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/offline/connectivity.ts lib/offline/connectivity.test.ts
git commit -m "feat: add online/offline connectivity hook"
```

---

### Task 8: Sync engine (queue replay)

**Files:**
- Create: `lib/offline/sync-engine.ts`
- Test: `lib/offline/sync-engine.test.ts`

**Interfaces:**
- Consumes: `getQueue`, `removeFromQueue` from `lib/offline/queue.ts` (Task 4); `QueueEntry` from `lib/offline/db.ts` (Task 2); `createBill`, `updateBill`, `deleteBill`, `closeBillCycle`, `createRecurringBill` from `lib/bills-repository.ts`; `createReminder`, `updateReminder`, `deleteReminder`, `closeReminderCycle`, `createRecurringReminder` from `lib/reminders-repository.ts`.
- Produces: `SyncFailure` interface (`{ entry: QueueEntry, error: unknown }`), `processQueue(refetchAndCache: () => Promise<void>): Promise<SyncFailure[]>`. Consumed by Task 9/10 (`use-bills.ts`/`use-reminders.ts`).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/offline/sync-engine.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetDbForTests } from './db';
import { enqueueMutation, getQueue } from './queue';

const createBillMock = vi.fn();
const deleteBillMock = vi.fn();
vi.mock('../bills-repository', () => ({
  createBill: createBillMock,
  updateBill: vi.fn(),
  deleteBill: deleteBillMock,
  closeBillCycle: vi.fn(),
  createRecurringBill: vi.fn(),
}));
vi.mock('../reminders-repository', () => ({
  createReminder: vi.fn(),
  updateReminder: vi.fn(),
  deleteReminder: vi.fn(),
  closeReminderCycle: vi.fn(),
  createRecurringReminder: vi.fn(),
}));

import { processQueue } from './sync-engine';

afterEach(async () => {
  vi.clearAllMocks();
  resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kb-personals-offline');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

describe('processQueue', () => {
  it('replays entries in order and removes them on success', async () => {
    createBillMock.mockResolvedValue(undefined);
    deleteBillMock.mockResolvedValue(undefined);
    await enqueueMutation({ entity: 'bill', operation: 'createBill', args: [{ title: 'A' }] });
    await enqueueMutation({ entity: 'bill', operation: 'deleteBill', args: ['bill-1'] });

    const refetchAndCache = vi.fn().mockResolvedValue(undefined);
    const failures = await processQueue(refetchAndCache);

    expect(createBillMock).toHaveBeenCalledWith({ title: 'A' });
    expect(deleteBillMock).toHaveBeenCalledWith('bill-1');
    expect(createBillMock.mock.invocationCallOrder[0]).toBeLessThan(deleteBillMock.mock.invocationCallOrder[0]);
    expect(failures).toEqual([]);
    expect(await getQueue()).toEqual([]);
    expect(refetchAndCache).toHaveBeenCalledTimes(1);
  });

  it('drops a failing entry and reports it without blocking the rest of the queue', async () => {
    createBillMock.mockRejectedValue(new Error('conflict'));
    deleteBillMock.mockResolvedValue(undefined);
    await enqueueMutation({ entity: 'bill', operation: 'createBill', args: [{ title: 'A' }] });
    await enqueueMutation({ entity: 'bill', operation: 'deleteBill', args: ['bill-1'] });

    const refetchAndCache = vi.fn().mockResolvedValue(undefined);
    const failures = await processQueue(refetchAndCache);

    expect(deleteBillMock).toHaveBeenCalled();
    expect(failures).toHaveLength(1);
    expect(failures[0].entry.operation).toBe('createBill');
    expect(await getQueue()).toEqual([]);
  });

  it('does not call refetchAndCache when the queue is empty', async () => {
    const refetchAndCache = vi.fn().mockResolvedValue(undefined);
    const failures = await processQueue(refetchAndCache);
    expect(refetchAndCache).not.toHaveBeenCalled();
    expect(failures).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/offline/sync-engine.test.ts`
Expected: FAIL with "Cannot find module './sync-engine'"

- [ ] **Step 3: Write the implementation**

```typescript
// lib/offline/sync-engine.ts
import { getQueue, removeFromQueue } from './queue';
import type { QueueEntry } from './db';
import { createBill, updateBill, deleteBill, closeBillCycle, createRecurringBill } from '../bills-repository';
import {
  createReminder,
  updateReminder,
  deleteReminder,
  closeReminderCycle,
  createRecurringReminder,
} from '../reminders-repository';

type RepositoryFn = (...args: unknown[]) => Promise<unknown>;

const OPERATIONS: Record<QueueEntry['entity'], Record<string, RepositoryFn>> = {
  bill: {
    createBill: createBill as unknown as RepositoryFn,
    updateBill: updateBill as unknown as RepositoryFn,
    deleteBill: deleteBill as unknown as RepositoryFn,
    closeBillCycle: closeBillCycle as unknown as RepositoryFn,
    createRecurringBill: createRecurringBill as unknown as RepositoryFn,
  },
  reminder: {
    createReminder: createReminder as unknown as RepositoryFn,
    updateReminder: updateReminder as unknown as RepositoryFn,
    deleteReminder: deleteReminder as unknown as RepositoryFn,
    closeReminderCycle: closeReminderCycle as unknown as RepositoryFn,
    createRecurringReminder: createRecurringReminder as unknown as RepositoryFn,
  },
};

export interface SyncFailure {
  entry: QueueEntry;
  error: unknown;
}

export async function processQueue(refetchAndCache: () => Promise<void>): Promise<SyncFailure[]> {
  const queue = await getQueue();
  if (queue.length === 0) return [];

  const failures: SyncFailure[] = [];

  for (const entry of queue) {
    const fn = OPERATIONS[entry.entity]?.[entry.operation];
    if (!fn) {
      failures.push({ entry, error: new Error(`Unknown operation: ${entry.entity}.${entry.operation}`) });
      await removeFromQueue(entry.id);
      continue;
    }
    try {
      await fn(...entry.args);
      await removeFromQueue(entry.id);
    } catch (error) {
      failures.push({ entry, error });
      await removeFromQueue(entry.id);
    }
  }

  await refetchAndCache();
  return failures;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/offline/sync-engine.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/offline/sync-engine.ts lib/offline/sync-engine.test.ts
git commit -m "feat: add offline queue replay (sync engine)"
```

---

### Task 9: Wire `use-bills.ts`

**Files:**
- Modify: `lib/use-bills.ts`
- Modify: `lib/use-bills.test.ts`

**Interfaces:**
- Consumes: `cacheList`, `getCachedList` from `lib/offline/cache.ts` (Task 3); `attemptOrQueue` from `lib/offline/attempt-or-queue.ts` (Task 6); `isNetworkError` from `lib/offline/network-error.ts` (Task 5); `useOnlineStatus` from `lib/offline/connectivity.ts` (Task 7); `processQueue` from `lib/offline/sync-engine.ts` (Task 8).
- Produces: `UseBillsResult` gains `pendingSyncIds: Set<string>`. Every existing mutation now falls back to offline queuing on a network error instead of surfacing an error. `refresh()` falls back to the IndexedDB cache on a network error instead of surfacing an error, and re-caches on every successful fetch.

- [ ] **Step 1: Write the failing test additions**

Add to `lib/use-bills.test.ts` (import `cacheList` from `./offline/cache`, `getQueue` from
`./offline/queue`, `resetDbForTests` from `./offline/db`; add an `afterEach` that resets
the offline DB the same way the `lib/offline/*.test.ts` files do, since `fake-indexeddb`
is a global singleton shared across the whole test run and `db.ts`'s cached `dbPromise`
would otherwise leak state between tests in this file):

```typescript
import { cacheList } from './offline/cache';
import { getQueue } from './offline/queue';
import { resetDbForTests } from './offline/db';

describe('useBills offline behavior', () => {
  afterEach(async () => {
    resetDbForTests();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('kb-personals-offline');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });

  it('falls back to cached bills when the list fetch fails with a network error', async () => {
    await cacheList('bills', [bill]);
    listBillsMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.bills).toEqual([bill]);
    expect(result.current.error).toBeNull();
  });

  it('queues a create and applies an optimistic update when offline', async () => {
    listBillsMock.mockResolvedValue([]);
    createBillMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createBill({ title: 'Water Bill', categoryId: 'cat-1', amount: 30, dueDate: '2026-09-01', recurrence: null });
    });

    expect(result.current.bills).toHaveLength(1);
    expect(result.current.bills[0]).toMatchObject({ title: 'Water Bill', amount: 30 });
    expect(result.current.pendingSyncIds.size).toBe(1);
    const queue = await getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].operation).toBe('createBill');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/use-bills.test.ts`
Expected: FAIL — the offline fallback/queue behavior doesn't exist yet, and
`pendingSyncIds` isn't on the hook's return value

- [ ] **Step 3: Rewrite `use-bills.ts`**

```typescript
// lib/use-bills.ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { listBills, createBill, updateBill, deleteBill, createRecurringBill, closeBillCycle } from './bills-repository';
import type { BillWithCategoryId } from './bills-repository';
import type { RecurrenceInterval } from './bills-types';
import type { CreateSeriesInput } from './recurring-types';
import { cacheList, getCachedList } from './offline/cache';
import { attemptOrQueue } from './offline/attempt-or-queue';
import { isNetworkError } from './offline/network-error';
import { useOnlineStatus } from './offline/connectivity';
import { processQueue } from './offline/sync-engine';

export interface UseBillsResult {
  bills: BillWithCategoryId[];
  loading: boolean;
  error: string | null;
  pendingSyncIds: Set<string>;
  refresh: () => Promise<void>;
  createBill: (input: { title: string; categoryId: string; amount: number; dueDate: string; recurrence: RecurrenceInterval }) => Promise<void>;
  createRecurringBill: (
    billInput: { title: string; categoryId: string; amount: number; dueDate: string },
    seriesInput: Omit<CreateSeriesInput, 'entityType'>
  ) => Promise<void>;
  updateBill: (
    id: string,
    patch: Partial<{ title: string; categoryId: string; amount: number; dueDate: string; recurrence: RecurrenceInterval; paid: boolean }>
  ) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;
  togglePaid: (id: string) => Promise<void>;
  skipCycle: (id: string) => Promise<void>;
}

export function useBills(): UseBillsResult {
  const [bills, setBills] = useState<BillWithCategoryId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingSyncIds, setPendingSyncIds] = useState<Set<string>>(new Set());
  const requestIdRef = useRef(0);
  const isOnline = useOnlineStatus();

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await listBills();
      if (requestId !== requestIdRef.current) return;
      setBills(result);
      await cacheList('bills', result);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      if (isNetworkError(err)) {
        const cached = await getCachedList<BillWithCategoryId>('bills');
        setBills(cached);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load bills');
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isOnline) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    processQueue(refresh).then(() => setPendingSyncIds(new Set()));
  }, [isOnline, refresh]);

  const mutate = useCallback(
    async (operation: string, args: unknown[], liveCall: () => Promise<unknown>, applyOptimistic: () => void) => {
      setError(null);
      try {
        await liveCall();
        await refresh();
      } catch (err) {
        if (!isNetworkError(err)) {
          setError(err instanceof Error ? err.message : 'Action failed');
          throw err;
        }
        await attemptOrQueue('bill', operation, args, () => Promise.reject(err), applyOptimistic);
      }
    },
    [refresh]
  );

  return {
    bills,
    loading,
    error,
    pendingSyncIds,
    refresh,
    createBill: (input) => {
      const tempId = crypto.randomUUID();
      return mutate('createBill', [input], () => createBill(input), () => {
        setBills((prev) => [
          ...prev,
          {
            id: tempId,
            title: input.title,
            category: '',
            categoryId: input.categoryId,
            amount: input.amount,
            dueDate: input.dueDate,
            recurrence: input.recurrence,
            paid: false,
            seriesId: null,
            cycleNumber: null,
            skipped: false,
          },
        ]);
        setPendingSyncIds((prev) => new Set(prev).add(tempId));
      });
    },
    createRecurringBill: (billInput, seriesInput) => {
      const tempId = crypto.randomUUID();
      return mutate('createRecurringBill', [billInput, seriesInput], () => createRecurringBill(billInput, seriesInput), () => {
        setBills((prev) => [
          ...prev,
          {
            id: tempId,
            title: billInput.title,
            category: '',
            categoryId: billInput.categoryId,
            amount: billInput.amount,
            dueDate: billInput.dueDate,
            recurrence: null,
            paid: false,
            seriesId: null,
            cycleNumber: null,
            skipped: false,
          },
        ]);
        setPendingSyncIds((prev) => new Set(prev).add(tempId));
      });
    },
    updateBill: (id, patch) =>
      mutate('updateBill', [id, patch], () => updateBill(id, patch), () => {
        setBills((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
        setPendingSyncIds((prev) => new Set(prev).add(id));
      }),
    deleteBill: (id) =>
      mutate('deleteBill', [id], () => deleteBill(id), () => {
        setBills((prev) => prev.filter((b) => b.id !== id));
      }),
    togglePaid: (id) => {
      const bill = bills.find((b) => b.id === id);
      if (!bill) return Promise.resolve();
      if (!bill.paid && bill.seriesId) {
        return mutate('closeBillCycle', [id, 'paid'], () => closeBillCycle(id, 'paid'), () => {
          setBills((prev) => prev.map((b) => (b.id === id ? { ...b, paid: true } : b)));
          setPendingSyncIds((prev) => new Set(prev).add(id));
        });
      }
      return mutate('updateBill', [id, { paid: !bill.paid }], () => updateBill(id, { paid: !bill.paid }), () => {
        setBills((prev) => prev.map((b) => (b.id === id ? { ...b, paid: !bill.paid } : b)));
        setPendingSyncIds((prev) => new Set(prev).add(id));
      });
    },
    skipCycle: (id) =>
      mutate('closeBillCycle', [id, 'skipped'], () => closeBillCycle(id, 'skipped'), () => {
        setBills((prev) => prev.map((b) => (b.id === id ? { ...b, skipped: true } : b)));
        setPendingSyncIds((prev) => new Set(prev).add(id));
      }),
  };
}
```

Note on `mutate`'s implementation: it calls `attemptOrQueue('bill', operation, args, () =>
Promise.reject(err), applyOptimistic)` — passing a function that re-rejects with the
already-caught network error, rather than re-running `liveCall`. This reuses
`attemptOrQueue`'s enqueue-and-report logic without invoking the live call a second time
(it already failed once, in the outer `try`); `attemptOrQueue` catches that rejection,
confirms it's a network error again (it is, it's the same error object), and enqueues.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/use-bills.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/use-bills.ts lib/use-bills.test.ts
git commit -m "feat: wire offline cache fallback and mutation queuing into useBills"
```

---

### Task 10: Wire `use-reminders.ts`

**Files:**
- Modify: `lib/use-reminders.ts`
- Modify: `lib/use-reminders.test.ts`

**Interfaces:**
- Consumes: same offline modules as Task 9, mirrored for reminders.
- Produces: `UseRemindersResult` gains `pendingSyncIds: Set<string>`, with the same
  cache-fallback/queue-on-network-error behavior as `useBills`.

- [ ] **Step 1: Write the failing test additions**

Mirror Task 9 Step 1 exactly, adapted for reminders: import `cacheList` from
`./offline/cache`, `getQueue` from `./offline/queue`, `resetDbForTests` from
`./offline/db`; add the same `afterEach` DB-reset; add:

```typescript
describe('useReminders offline behavior', () => {
  afterEach(async () => {
    resetDbForTests();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('kb-personals-offline');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });

  it('falls back to cached reminders when the list fetch fails with a network error', async () => {
    await cacheList('reminders', [reminder]);
    listRemindersMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.reminders).toEqual([reminder]);
    expect(result.current.error).toBeNull();
  });

  it('queues a create and applies an optimistic update when offline', async () => {
    listRemindersMock.mockResolvedValue([]);
    createReminderMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createReminder({ title: 'Water plants', category: 'Home', dueDate: '2026-09-01', priority: 'low' });
    });

    expect(result.current.reminders).toHaveLength(1);
    expect(result.current.reminders[0]).toMatchObject({ title: 'Water plants' });
    expect(result.current.pendingSyncIds.size).toBe(1);
    const queue = await getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].operation).toBe('createReminder');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/use-reminders.test.ts`
Expected: FAIL — the offline fallback/queue behavior doesn't exist yet, and
`pendingSyncIds` isn't on the hook's return value

- [ ] **Step 3: Rewrite `use-reminders.ts`**

```typescript
// lib/use-reminders.ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { addDays, parseISO } from 'date-fns';
import { listReminders, createReminder, updateReminder, deleteReminder, createRecurringReminder, closeReminderCycle } from './reminders-repository';
import { toISODateString } from './date-utils';
import type { Priority, Reminder } from './reminders-types';
import type { CreateSeriesInput } from './recurring-types';
import { cacheList, getCachedList } from './offline/cache';
import { attemptOrQueue } from './offline/attempt-or-queue';
import { isNetworkError } from './offline/network-error';
import { useOnlineStatus } from './offline/connectivity';
import { processQueue } from './offline/sync-engine';

export interface UseRemindersResult {
  reminders: Reminder[];
  loading: boolean;
  error: string | null;
  pendingSyncIds: Set<string>;
  refresh: () => Promise<void>;
  createReminder: (input: { title: string; category: string; dueDate: string; priority: Priority }) => Promise<void>;
  createRecurringReminder: (
    reminderInput: { title: string; category: string; dueDate: string; priority: Priority },
    seriesInput: Omit<CreateSeriesInput, 'entityType'>
  ) => Promise<void>;
  updateReminder: (id: string, patch: Partial<{ title: string; category: string; dueDate: string; priority: Priority; completed: boolean }>) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
  skipCycle: (id: string) => Promise<void>;
  snooze: (id: string) => Promise<void>;
}

export function useReminders(): UseRemindersResult {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingSyncIds, setPendingSyncIds] = useState<Set<string>>(new Set());
  const requestIdRef = useRef(0);
  const isOnline = useOnlineStatus();

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await listReminders();
      if (requestId !== requestIdRef.current) return;
      setReminders(result);
      await cacheList('reminders', result);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      if (isNetworkError(err)) {
        const cached = await getCachedList<Reminder>('reminders');
        setReminders(cached);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load reminders');
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isOnline) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    processQueue(refresh).then(() => setPendingSyncIds(new Set()));
  }, [isOnline, refresh]);

  const mutate = useCallback(
    async (operation: string, args: unknown[], liveCall: () => Promise<unknown>, applyOptimistic: () => void) => {
      setError(null);
      try {
        await liveCall();
        await refresh();
      } catch (err) {
        if (!isNetworkError(err)) {
          setError(err instanceof Error ? err.message : 'Action failed');
          throw err;
        }
        await attemptOrQueue('reminder', operation, args, () => Promise.reject(err), applyOptimistic);
      }
    },
    [refresh]
  );

  return {
    reminders,
    loading,
    error,
    pendingSyncIds,
    refresh,
    createReminder: (input) => {
      const tempId = crypto.randomUUID();
      return mutate('createReminder', [input], () => createReminder(input), () => {
        setReminders((prev) => [
          ...prev,
          {
            id: tempId,
            title: input.title,
            category: input.category,
            dueDate: input.dueDate,
            priority: input.priority,
            completed: false,
            seriesId: null,
            cycleNumber: null,
            skipped: false,
          },
        ]);
        setPendingSyncIds((prev) => new Set(prev).add(tempId));
      });
    },
    createRecurringReminder: (reminderInput, seriesInput) => {
      const tempId = crypto.randomUUID();
      return mutate('createRecurringReminder', [reminderInput, seriesInput], () => createRecurringReminder(reminderInput, seriesInput), () => {
        setReminders((prev) => [
          ...prev,
          {
            id: tempId,
            title: reminderInput.title,
            category: reminderInput.category,
            dueDate: reminderInput.dueDate,
            priority: reminderInput.priority,
            completed: false,
            seriesId: null,
            cycleNumber: null,
            skipped: false,
          },
        ]);
        setPendingSyncIds((prev) => new Set(prev).add(tempId));
      });
    },
    updateReminder: (id, patch) =>
      mutate('updateReminder', [id, patch], () => updateReminder(id, patch), () => {
        setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
        setPendingSyncIds((prev) => new Set(prev).add(id));
      }),
    deleteReminder: (id) =>
      mutate('deleteReminder', [id], () => deleteReminder(id), () => {
        setReminders((prev) => prev.filter((r) => r.id !== id));
      }),
    toggleComplete: (id) => {
      const reminder = reminders.find((r) => r.id === id);
      if (!reminder) return Promise.resolve();
      if (!reminder.completed && reminder.seriesId) {
        return mutate('closeReminderCycle', [id, 'completed'], () => closeReminderCycle(id, 'completed'), () => {
          setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, completed: true } : r)));
          setPendingSyncIds((prev) => new Set(prev).add(id));
        });
      }
      return mutate('updateReminder', [id, { completed: !reminder.completed }], () => updateReminder(id, { completed: !reminder.completed }), () => {
        setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, completed: !reminder.completed } : r)));
        setPendingSyncIds((prev) => new Set(prev).add(id));
      });
    },
    skipCycle: (id) =>
      mutate('closeReminderCycle', [id, 'skipped'], () => closeReminderCycle(id, 'skipped'), () => {
        setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, skipped: true } : r)));
        setPendingSyncIds((prev) => new Set(prev).add(id));
      }),
    snooze: (id) => {
      const reminder = reminders.find((r) => r.id === id);
      if (!reminder) return Promise.resolve();
      const nextDate = toISODateString(addDays(parseISO(reminder.dueDate), 1));
      return mutate('updateReminder', [id, { dueDate: nextDate }], () => updateReminder(id, { dueDate: nextDate }), () => {
        setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, dueDate: nextDate } : r)));
        setPendingSyncIds((prev) => new Set(prev).add(id));
      });
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/use-reminders.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/use-reminders.ts lib/use-reminders.test.ts
git commit -m "feat: wire offline cache fallback and mutation queuing into useReminders"
```

---

### Task 11: Full suite verification

**Files:** none created — verification task.

- [ ] **Step 1: Run the full automated suite**

```bash
npx vitest run
npx tsc --noEmit
npx eslint .
npx next build
```

Expected: all green. The most likely spot for collateral breakage: any other test file
that renders components consuming `useBills()`/`useReminders()` directly (rather than a
page-level mock) and doesn't yet expect `pendingSyncIds` on the returned object — add it
to those mocks the same way `createRecurringBill`/`skipCycle` were added to `BillsPage`'s
tests in the recurring-items-engine work.

- [ ] **Step 2: Manual smoke test**

This step needs a real browser (DevTools' Network throttling → Offline), not just
automated tests:

1. Load the app online, let Bills/Reminders populate normally.
2. DevTools → Network → set to "Offline".
3. Reload the page — bills/reminders should still render from the IndexedDB cache
   instead of erroring.
4. Create a bill while offline — it should appear immediately in the list.
5. Mark a bill paid while offline — the checkmark should flip immediately.
6. DevTools → Network → set back to "Online" (or "No throttling").
7. Within a few seconds, confirm (via the Supabase dashboard or a fresh reload) that the
   offline-created bill and the paid status actually landed on the server.
