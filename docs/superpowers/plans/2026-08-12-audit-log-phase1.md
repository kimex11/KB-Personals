# Activity Log — Phase 1 (Foundation: schema, repository, viewer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Activity Log subsystem end to end at the infrastructure level — the `audit_log` table, the `logActivity`/`listAuditLog` write/read path, and a `/activity` viewer page — so later phases only need to add one `logActivity()` call per mutation in each repository.

**Architecture:** Per the design spec (`docs/superpowers/specs/2026-08-12-audit-log-design.md`), this is app-level logging: a new `lib/audit-log-repository.ts` module with `logActivity()` (insert) and `listAuditLog()` (select, newest-first), following the exact repository conventions already used throughout this codebase (manual row interfaces, `snake_case` DB columns mapped to `camelCase` TS, `createClient()` from `./supabase/client`). A new `lib/use-audit-log.ts` hook follows `lib/use-accounts.ts`'s exact shape (no offline caching — this is a read-only trail, not a page that needs offline mutation queueing). The `/activity` page renders a single-column list of tiles (per the tile-revamp language, but single-column since an audit trail is chronological, not grid-friendly). The page is reachable from a new icon in `Header.tsx` (not the bottom `TabBar` — that already has 6 items and Activity Log isn't a primary daily-use tab) and is added to `proxy.ts`'s `PROTECTED_PATHS` so it requires auth like every other page.

**Tech Stack:** React 19, TypeScript, Tailwind v4, vitest + @testing-library/react, date-fns, Supabase Postgres + RLS.

## Global Constraints

- No `update`/`delete` RLS policy on `audit_log` — Postgres RLS defaults to deny, making the table append-only. Do not add one "for convenience" in a later phase.
- `logActivity` must never throw in a way that blocks the mutation it's logging from succeeding in later phases — this phase establishes the function; later phases decide how each call site handles a logging failure (spec's call: log-write failures should not roll back or fail the underlying mutation, since losing an audit entry is much less bad than losing the user's actual bill/reminder/etc. edit). This phase's own tests just verify `logActivity` writes the right row shape.
- Timestamps: store `timestamptz` (UTC) in the DB (Postgres default for `timestamptz` + `now()`), render local time client-side via `date-fns`'s `format()`, which uses the JS `Date` object's local timezone by default — no manual UTC math needed, unlike the Philippines-hardcoded server-side notification scheduling (that was Edge-Function/server-side; this is client-rendered, where the browser's own timezone is exactly what "local" should mean for someone viewing their own activity history).
- This migration (`0013_audit_log.sql`) cannot be applied from this environment — same as migrations 0009-0012, flag it to the user as a manual `supabase db push` step.

---

### Task 1: `audit_log` table migration

**Files:**
- Create: `supabase/migrations/0013_audit_log.sql`

**Interfaces:**
- Produces: the `public.audit_log` table that `lib/audit-log-repository.ts` (Task 2) reads and writes.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0013_audit_log.sql`:

```sql
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  actor_email text not null,
  action text not null check (action in ('create', 'update', 'delete', 'upload', 'link', 'unlink', 'skip', 'archive', 'unarchive', 'merge')),
  entity_type text not null,
  entity_id uuid,
  entity_label text not null,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

create policy "Authenticated users can view audit log"
  on public.audit_log for select to authenticated using (true);
create policy "Authenticated users can insert audit log entries"
  on public.audit_log for insert to authenticated with check (auth.uid() = actor_id);

create index audit_log_created_at_idx on public.audit_log(created_at desc);
create index audit_log_entity_type_idx on public.audit_log(entity_type);
create index audit_log_actor_id_idx on public.audit_log(actor_id);
```

No `update`/`delete` policy is created on purpose — see Global Constraints.

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0013_audit_log.sql
git commit -m "feat: add audit_log table migration for the Activity Log subsystem"
```

Flag to the user: this migration needs `supabase db push` (or applying via the Supabase dashboard) before the Activity Log page will show real data — same manual step every migration since 0009 has needed in this environment.

---

### Task 2: `lib/audit-log-repository.ts`

**Files:**
- Create: `lib/audit-log-repository.ts`
- Create: `lib/audit-log-repository.test.ts`

**Interfaces:**
- Consumes: `createClient` from `./supabase/client`.
- Produces:
  - `type AuditAction = 'create' | 'update' | 'delete' | 'upload' | 'link' | 'unlink' | 'skip' | 'archive' | 'unarchive' | 'merge'`
  - `interface AuditLogEntry { id: string; actorId: string | null; actorEmail: string; action: AuditAction; entityType: string; entityId: string | null; entityLabel: string; beforeValue: Record<string, unknown> | null; afterValue: Record<string, unknown> | null; createdAt: string; }`
  - `logActivity(input: { action: AuditAction; entityType: string; entityId: string | null; entityLabel: string; beforeValue?: Record<string, unknown> | null; afterValue?: Record<string, unknown> | null; }): Promise<void>`
  - `listAuditLog(): Promise<AuditLogEntry[]>`
  - Consumed by `lib/use-audit-log.ts` (Task 3) and every repository wired in Phases 2-5.

- [ ] **Step 1: Write the failing test**

Create `lib/audit-log-repository.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

const mockInsert = vi.fn();
const mockOrder = vi.fn();
const mockGetUser = vi.fn();
vi.mock('./supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      insert: mockInsert,
      select: () => ({ order: mockOrder }),
    }),
  }),
}));

import { logActivity, listAuditLog } from './audit-log-repository';

describe('logActivity', () => {
  it('inserts a row with the current user as actor', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'sil@hhccs.com.au' } } });
    mockInsert.mockResolvedValue({ error: null });

    await logActivity({
      action: 'create',
      entityType: 'bill',
      entityId: 'bill-1',
      entityLabel: 'Internet Bill',
      afterValue: { amount: 59.99 },
    });

    expect(mockInsert).toHaveBeenCalledWith({
      actor_id: 'user-1',
      actor_email: 'sil@hhccs.com.au',
      action: 'create',
      entity_type: 'bill',
      entity_id: 'bill-1',
      entity_label: 'Internet Bill',
      before_value: null,
      after_value: { amount: 59.99 },
    });
  });

  it('falls back to a null actor and "unknown" email when no user is signed in', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockInsert.mockResolvedValue({ error: null });

    await logActivity({ action: 'delete', entityType: 'bill', entityId: 'bill-1', entityLabel: 'Internet Bill' });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ actor_id: null, actor_email: 'unknown' })
    );
  });

  it('throws when the insert fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'a@b.com' } } });
    mockInsert.mockResolvedValue({ error: new Error('insert failed') });

    await expect(
      logActivity({ action: 'create', entityType: 'bill', entityId: 'bill-1', entityLabel: 'X' })
    ).rejects.toThrow('insert failed');
  });
});

describe('listAuditLog', () => {
  it('maps rows to camelCase, newest first', async () => {
    mockOrder.mockResolvedValue({
      data: [
        {
          id: 'log-1',
          actor_id: 'user-1',
          actor_email: 'sil@hhccs.com.au',
          action: 'update',
          entity_type: 'bill',
          entity_id: 'bill-1',
          entity_label: 'Internet Bill',
          before_value: { amount: 50 },
          after_value: { amount: 59.99 },
          created_at: '2026-08-12T10:00:00.000Z',
        },
      ],
      error: null,
    });

    const result = await listAuditLog();

    expect(result).toEqual([
      {
        id: 'log-1',
        actorId: 'user-1',
        actorEmail: 'sil@hhccs.com.au',
        action: 'update',
        entityType: 'bill',
        entityId: 'bill-1',
        entityLabel: 'Internet Bill',
        beforeValue: { amount: 50 },
        afterValue: { amount: 59.99 },
        createdAt: '2026-08-12T10:00:00.000Z',
      },
    ]);
  });

  it('throws when the select fails', async () => {
    mockOrder.mockResolvedValue({ data: null, error: new Error('select failed') });
    await expect(listAuditLog()).rejects.toThrow('select failed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/audit-log-repository.test.ts`
Expected: FAIL — `Cannot find module './audit-log-repository'`

- [ ] **Step 3: Write the implementation**

Create `lib/audit-log-repository.ts`:

```ts
import { createClient } from './supabase/client';

export type AuditAction = 'create' | 'update' | 'delete' | 'upload' | 'link' | 'unlink' | 'skip' | 'archive' | 'unarchive' | 'merge';

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorEmail: string;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  entityLabel: string;
  beforeValue: Record<string, unknown> | null;
  afterValue: Record<string, unknown> | null;
  createdAt: string;
}

interface AuditLogRow {
  id: string;
  actor_id: string | null;
  actor_email: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  created_at: string;
}

function rowToEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorEmail: row.actor_email,
    action: row.action as AuditAction,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityLabel: row.entity_label,
    beforeValue: row.before_value,
    afterValue: row.after_value,
    createdAt: row.created_at,
  };
}

export interface LogActivityInput {
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  entityLabel: string;
  beforeValue?: Record<string, unknown> | null;
  afterValue?: Record<string, unknown> | null;
}

export async function logActivity(input: LogActivityInput): Promise<void> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const actor = userData.user;

  const { error } = await supabase.from('audit_log').insert({
    actor_id: actor?.id ?? null,
    actor_email: actor?.email ?? 'unknown',
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    entity_label: input.entityLabel,
    before_value: input.beforeValue ?? null,
    after_value: input.afterValue ?? null,
  });
  if (error) throw error;
}

export async function listAuditLog(): Promise<AuditLogEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as AuditLogRow[]).map(rowToEntry);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/audit-log-repository.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/audit-log-repository.ts lib/audit-log-repository.test.ts
git commit -m "feat: add audit-log-repository with logActivity/listAuditLog"
```

---

### Task 3: `lib/use-audit-log.ts` hook

**Files:**
- Create: `lib/use-audit-log.ts`
- Create: `lib/use-audit-log.test.ts`

**Interfaces:**
- Consumes: `listAuditLog`, `AuditLogEntry` from `./audit-log-repository` (Task 2).
- Produces: `useAuditLog(): { entries: AuditLogEntry[]; loading: boolean; error: string | null; refresh: () => Promise<void>; }` — consumed by the `/activity` page (Task 5).

- [ ] **Step 1: Write the failing test**

Create `lib/use-audit-log.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const listAuditLogMock = vi.fn();
vi.mock('./audit-log-repository', () => ({ listAuditLog: listAuditLogMock }));

import { useAuditLog } from './use-audit-log';

describe('useAuditLog', () => {
  it('loads entries on mount', async () => {
    listAuditLogMock.mockResolvedValue([
      { id: 'log-1', actorId: 'user-1', actorEmail: 'a@b.com', action: 'create', entityType: 'bill', entityId: 'bill-1', entityLabel: 'Rent', beforeValue: null, afterValue: { amount: 100 }, createdAt: '2026-08-12T10:00:00.000Z' },
    ]);

    const { result } = renderHook(() => useAuditLog());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('sets an error message when loading fails', async () => {
    listAuditLogMock.mockRejectedValue(new Error('Could not load activity.'));

    const { result } = renderHook(() => useAuditLog());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Could not load activity.');
    expect(result.current.entries).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/use-audit-log.test.ts`
Expected: FAIL — `Cannot find module './use-audit-log'`

- [ ] **Step 3: Write the implementation**

Create `lib/use-audit-log.ts`:

```ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { listAuditLog, type AuditLogEntry } from './audit-log-repository';

export interface UseAuditLogResult {
  entries: AuditLogEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAuditLog(): UseAuditLogResult {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const rows = await listAuditLog();
      if (requestId !== requestIdRef.current) return;
      setEntries(rows);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load activity log');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  return { entries, loading, error, refresh };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/use-audit-log.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/use-audit-log.ts lib/use-audit-log.test.ts
git commit -m "feat: add useAuditLog hook"
```

---

### Task 4: `ActivityLogEntryTile` and `ActivityLogList` components

**Files:**
- Create: `components/activity/ActivityLogEntryTile.tsx`
- Create: `components/activity/ActivityLogEntryTile.test.tsx`
- Create: `components/activity/ActivityLogList.tsx`
- Create: `components/activity/ActivityLogList.test.tsx`

**Interfaces:**
- Consumes: `AuditLogEntry` from `@/lib/audit-log-repository` (Task 2); `EmptyState` from `@/components/shared/EmptyState`.
- Produces: `ActivityLogEntryTile({ entry: AuditLogEntry })`, `ActivityLogList({ entries: AuditLogEntry[] })` — consumed by the `/activity` page (Task 5).

- [ ] **Step 1: Write the failing test for `ActivityLogEntryTile`**

Create `components/activity/ActivityLogEntryTile.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityLogEntryTile } from './ActivityLogEntryTile';
import type { AuditLogEntry } from '@/lib/audit-log-repository';

const baseEntry: AuditLogEntry = {
  id: 'log-1',
  actorId: 'user-1',
  actorEmail: 'sil@hhccs.com.au',
  action: 'create',
  entityType: 'bill',
  entityId: 'bill-1',
  entityLabel: 'Internet Bill',
  beforeValue: null,
  afterValue: { amount: 59.99 },
  createdAt: '2026-08-12T10:00:00.000Z',
};

describe('ActivityLogEntryTile', () => {
  it('shows the action label, entity label, and actor email', () => {
    render(<ActivityLogEntryTile entry={baseEntry} />);
    const tile = screen.getByTestId('activity-log-entry');
    expect(tile).toHaveTextContent('Created');
    expect(tile).toHaveTextContent('Internet Bill');
    expect(tile).toHaveTextContent('sil@hhccs.com.au');
  });

  it('tints the tile to match the action', () => {
    render(<ActivityLogEntryTile entry={baseEntry} />);
    expect(screen.getByTestId('activity-log-entry')).toHaveClass('bg-status-success/10');
  });

  it('shows an after value in an expandable details section when present', () => {
    render(<ActivityLogEntryTile entry={baseEntry} />);
    expect(screen.getByTestId('activity-log-after')).toHaveTextContent('amount: 59.99');
    expect(screen.queryByTestId('activity-log-before')).not.toBeInTheDocument();
  });

  it('shows both before and after values for an update', () => {
    const update: AuditLogEntry = { ...baseEntry, action: 'update', beforeValue: { amount: 50 }, afterValue: { amount: 59.99 } };
    render(<ActivityLogEntryTile entry={update} />);
    expect(screen.getByTestId('activity-log-before')).toHaveTextContent('amount: 50');
    expect(screen.getByTestId('activity-log-after')).toHaveTextContent('amount: 59.99');
  });

  it('shows no details section when neither value is present', () => {
    const deleted: AuditLogEntry = { ...baseEntry, action: 'delete', afterValue: null };
    render(<ActivityLogEntryTile entry={deleted} />);
    expect(screen.queryByTestId('activity-log-before')).not.toBeInTheDocument();
    expect(screen.queryByTestId('activity-log-after')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/activity/ActivityLogEntryTile.test.tsx`
Expected: FAIL — `Cannot find module './ActivityLogEntryTile'`

- [ ] **Step 3: Write the `ActivityLogEntryTile` implementation**

Create `components/activity/ActivityLogEntryTile.tsx`:

```tsx
import { format } from 'date-fns';
import { Plus, Pencil, Trash2, Upload, Link as LinkIcon, Unlink, SkipForward, Archive, ArchiveRestore, Merge } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AuditAction, AuditLogEntry } from '@/lib/audit-log-repository';

const ACTION_CONFIG: Record<AuditAction, { icon: LucideIcon; label: string; tintClassName: string; iconClassName: string }> = {
  create: { icon: Plus, label: 'Created', tintClassName: 'bg-status-success/10', iconClassName: 'text-status-success' },
  update: { icon: Pencil, label: 'Updated', tintClassName: 'bg-status-warning/10', iconClassName: 'text-status-warning' },
  delete: { icon: Trash2, label: 'Deleted', tintClassName: 'bg-status-critical/10', iconClassName: 'text-status-critical' },
  upload: { icon: Upload, label: 'Uploaded', tintClassName: 'bg-calendar-task/10', iconClassName: 'text-calendar-task' },
  link: { icon: LinkIcon, label: 'Linked', tintClassName: 'bg-calendar-reminder/10', iconClassName: 'text-calendar-reminder' },
  unlink: { icon: Unlink, label: 'Unlinked', tintClassName: 'bg-neutral-100', iconClassName: 'text-neutral-500' },
  skip: { icon: SkipForward, label: 'Skipped', tintClassName: 'bg-neutral-100', iconClassName: 'text-neutral-500' },
  archive: { icon: Archive, label: 'Archived', tintClassName: 'bg-neutral-100', iconClassName: 'text-neutral-500' },
  unarchive: { icon: ArchiveRestore, label: 'Unarchived', tintClassName: 'bg-neutral-100', iconClassName: 'text-neutral-500' },
  merge: { icon: Merge, label: 'Merged', tintClassName: 'bg-gold/10', iconClassName: 'text-gold' },
};

function formatValue(value: Record<string, unknown> | null): string | null {
  if (!value) return null;
  return Object.entries(value)
    .map(([key, val]) => `${key}: ${String(val)}`)
    .join(', ');
}

export function ActivityLogEntryTile({ entry }: { entry: AuditLogEntry }) {
  const config = ACTION_CONFIG[entry.action];
  const Icon = config.icon;
  const before = formatValue(entry.beforeValue);
  const after = formatValue(entry.afterValue);

  return (
    <div data-testid="activity-log-entry" className={`flex flex-col gap-2 rounded-2xl p-4 ${config.tintClassName}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white ${config.iconClassName}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium text-neutral-900">
            {config.label} <span className="font-normal text-neutral-500">{entry.entityLabel}</span>
          </p>
          <p className="text-xs text-neutral-500">
            {entry.actorEmail} · {format(new Date(entry.createdAt), "MMM d, yyyy 'at' h:mm a")}
          </p>
        </div>
      </div>
      {(before || after) && (
        <details className="text-xs text-neutral-500">
          <summary className="cursor-pointer select-none">Details</summary>
          <div className="mt-1 flex flex-col gap-1 border-t border-white/60 pt-1">
            {before && <p data-testid="activity-log-before">Before: {before}</p>}
            {after && <p data-testid="activity-log-after">After: {after}</p>}
          </div>
        </details>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/activity/ActivityLogEntryTile.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Write the failing test for `ActivityLogList`**

Create `components/activity/ActivityLogList.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityLogList } from './ActivityLogList';
import type { AuditLogEntry } from '@/lib/audit-log-repository';

const entries: AuditLogEntry[] = [
  { id: 'log-1', actorId: 'user-1', actorEmail: 'a@b.com', action: 'create', entityType: 'bill', entityId: 'bill-1', entityLabel: 'Rent', beforeValue: null, afterValue: { amount: 100 }, createdAt: '2026-08-12T10:00:00.000Z' },
  { id: 'log-2', actorId: 'user-1', actorEmail: 'a@b.com', action: 'delete', entityType: 'reminder', entityId: 'rem-1', entityLabel: 'Call bank', beforeValue: { title: 'Call bank' }, afterValue: null, createdAt: '2026-08-12T09:00:00.000Z' },
];

describe('ActivityLogList', () => {
  it('shows an empty state when there are no entries', () => {
    render(<ActivityLogList entries={[]} />);
    expect(screen.getByTestId('empty-state')).toHaveTextContent('No activity recorded yet.');
  });

  it('renders one tile per entry', () => {
    render(<ActivityLogList entries={entries} />);
    expect(screen.getAllByTestId('activity-log-entry')).toHaveLength(2);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run components/activity/ActivityLogList.test.tsx`
Expected: FAIL — `Cannot find module './ActivityLogList'`

- [ ] **Step 7: Write the `ActivityLogList` implementation**

Create `components/activity/ActivityLogList.tsx`:

```tsx
import type { AuditLogEntry } from '@/lib/audit-log-repository';
import { ActivityLogEntryTile } from './ActivityLogEntryTile';
import { EmptyState } from '@/components/shared/EmptyState';

export function ActivityLogList({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState message="No activity recorded yet." />;
  }

  return (
    <div data-testid="activity-log-list" className="flex flex-col gap-2">
      {entries.map((entry) => (
        <ActivityLogEntryTile key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run components/activity/ActivityLogList.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 9: Commit**

```bash
git add components/activity/
git commit -m "feat: add ActivityLogEntryTile and ActivityLogList components"
```

---

### Task 5: `/activity` page

**Files:**
- Create: `app/(shell)/activity/page.tsx`
- Create: `app/(shell)/activity/page.test.tsx`

**Interfaces:**
- Consumes: `useAuditLog` from `@/lib/use-audit-log` (Task 3); `ActivityLogList` from `@/components/activity/ActivityLogList` (Task 4); `useIsMounted` from `@/lib/use-is-mounted` (existing).

- [ ] **Step 1: Write the failing test**

Create `app/(shell)/activity/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ActivityPage from './page';
import type { AuditLogEntry } from '@/lib/audit-log-repository';

const listAuditLogMock = vi.fn();
vi.mock('@/lib/audit-log-repository', () => ({ listAuditLog: listAuditLogMock }));

describe('ActivityPage', () => {
  it('shows a loading state, then the activity list', async () => {
    const entries: AuditLogEntry[] = [
      { id: 'log-1', actorId: 'user-1', actorEmail: 'a@b.com', action: 'create', entityType: 'bill', entityId: 'bill-1', entityLabel: 'Rent', beforeValue: null, afterValue: { amount: 100 }, createdAt: '2026-08-12T10:00:00.000Z' },
    ];
    listAuditLogMock.mockResolvedValue(entries);

    render(<ActivityPage />);

    await waitFor(() => expect(screen.getAllByTestId('activity-log-entry')).toHaveLength(1));
  });

  it('shows an error message when loading fails', async () => {
    listAuditLogMock.mockRejectedValue(new Error('Could not load activity.'));

    render(<ActivityPage />);

    expect(await screen.findByText('Could not load activity.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/(shell)/activity/page.test.tsx"`
Expected: FAIL — `Cannot find module './page'`

- [ ] **Step 3: Write the implementation**

Create `app/(shell)/activity/page.tsx`:

```tsx
'use client';

import { useAuditLog } from '@/lib/use-audit-log';
import { ActivityLogList } from '@/components/activity/ActivityLogList';
import { useIsMounted } from '@/lib/use-is-mounted';

export default function ActivityPage() {
  const isMounted = useIsMounted();
  const { entries, loading, error } = useAuditLog();

  return (
    <div data-testid="activity-page" className="flex flex-col gap-4 px-4 pb-24 pt-4">
      {error && <p className="text-sm text-status-critical">{error}</p>}
      {isMounted && loading && (
        <p data-testid="activity-loading" className="text-center text-sm text-neutral-400">
          Loading activity…
        </p>
      )}
      {isMounted && !loading && <ActivityLogList entries={entries} />}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "app/(shell)/activity/page.test.tsx"`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add "app/(shell)/activity/"
git commit -m "feat: add the /activity page"
```

---

### Task 6: Wire navigation — Header link and route protection

**Files:**
- Modify: `components/shell/Header.tsx`
- Modify: `components/shell/Header.test.tsx`
- Modify: `proxy.ts`

**Interfaces:**
- No new exports — this task only wires existing pieces into the app shell and route guard.

- [ ] **Step 1: Write the failing test**

In `components/shell/Header.test.tsx`, add:

```tsx
  it('renders a link to the Activity Log', () => {
    render(<Header />);
    expect(screen.getByRole('link', { name: /activity log/i })).toHaveAttribute('href', '/activity');
  });
```

(add inside the existing `describe('Header', ...)` block, alongside the other two tests)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/shell/Header.test.tsx`
Expected: FAIL — no element found with role `link` and name matching `/activity log/i`

- [ ] **Step 3: Update `Header.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { History } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { TAB_ITEMS } from './tab-config';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';

export function Header() {
  const pathname = usePathname();
  const title = TAB_ITEMS.find((tab) => tab.href === pathname)?.label ?? 'Home';

  return (
    <header data-testid="app-header" className="flex items-center gap-3 px-4 pb-2 pt-6">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-serif text-sm text-gold">
        KB
      </span>
      <h1 className="font-serif text-xl text-neutral-900">{title}</h1>
      <div className="ml-auto flex items-center gap-2">
        <Link href="/activity" aria-label="Activity Log" className="text-neutral-500">
          <History className="h-5 w-5" />
        </Link>
        <InstallPrompt />
        <LogoutButton />
      </div>
    </header>
  );
}
```

(adds the `Link`/`History` import and the new `<Link>`, everything else unchanged)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/shell/Header.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Add `/activity` to `PROTECTED_PATHS`**

In `proxy.ts`:

```ts
export const PROTECTED_PATHS = ['/', '/budget', '/bills', '/accounts', '/reminders', '/receipts', '/activity'];
```

(replaces the existing `PROTECTED_PATHS` array — same array, one more entry)

- [ ] **Step 6: Run the existing proxy test to verify no regression**

Run: `npx vitest run proxy.test.ts`
Expected: PASS (unchanged test count — `/activity` isn't a tab route, so the "every tab route is protected" test doesn't need to know about it, but the path is still guarded)

- [ ] **Step 7: Commit**

```bash
git add components/shell/Header.tsx components/shell/Header.test.tsx proxy.ts
git commit -m "feat: link the Activity Log from the header and protect its route"
```

---

### Task 7: Full suite verification

**Files:** None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All test files pass.

- [ ] **Step 2: Run the TypeScript compiler**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Run the linter**

Run: `npx eslint .`
Expected: No errors.

- [ ] **Step 4: Run the production build**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 5: Manual smoke check (note only)**

Not executable in this environment — flag to the user: after applying migration `0013_audit_log.sql`, open `/activity` from the new header icon and confirm it loads (empty state until Phase 2+ starts writing entries). This phase alone produces zero log entries — the table exists and the viewer works, but nothing writes to it until Phase 2 wires `logActivity` into Bills.
