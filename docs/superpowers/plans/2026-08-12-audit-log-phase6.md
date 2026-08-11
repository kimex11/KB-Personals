# Activity Log — Phase 6 (search/filter UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/activity` gets search (by item/actor) and filter (by action type, module/entity type, date range) — the last requirement from the original 2026-08-07 request, deferred in the design spec until real log data existed across all entities (Phases 2-5, now shipped).

**Architecture refinement from the design spec**: the spec's `listAuditLog(filters?)` sketch implied server-side query params. This plan instead does **client-side filtering over the already-fetched list**, via a pure selector function — matching this codebase's own established convention for every other list screen (`filterBills`/`sortBills` in `lib/bills-selectors.ts`, consumed by `BillsListView`; `filterReminders`/`sortReminders` in `lib/reminders-selectors.ts`, consumed by `RemindersListView`). `ActivityLogList` grows to own its own filter state internally (query, action, entity type, date range) and renders `ActivityLogFilterBar` above the list, exactly like `BillsListView` owns its own `query`/`statusFilter`/`sortBy` state and renders `BillsFilterBar`. `listAuditLog()` itself is unchanged — it already returns everything, newest-first, which is all a client-side filter needs.

**Tech Stack:** React 19, TypeScript, Tailwind v4, vitest + @testing-library/react + @testing-library/user-event.

## Global Constraints

- No change to `lib/audit-log-repository.ts` or the `audit_log` schema.
- Filtering is entirely client-side, over the list `useAuditLog()` already fetched — no new network calls per filter change.
- Matches `BillsListView`'s convention of a single "no results" message covering both the truly-empty and the filtered-to-empty cases (`EmptyState message="No activity matches your filters."`) rather than two different messages — this is an intentional wording change from Phase 1's "No activity recorded yet.", not an oversight.

---

### Task 1: `filterAuditLog` selector

**Files:**
- Create: `lib/audit-log-selectors.ts`
- Create: `lib/audit-log-selectors.test.ts`

**Interfaces:**
- Consumes: `AuditAction`, `AuditLogEntry` from `./audit-log-repository`.
- Produces: `interface AuditLogFilters { query: string; actionFilter: AuditAction | 'all'; entityTypeFilter: string; dateFrom: string | null; dateTo: string | null; }` and `filterAuditLog(entries: AuditLogEntry[], filters: AuditLogFilters): AuditLogEntry[]` — consumed by `ActivityLogList` (Task 3).

- [ ] **Step 1: Write the failing test**

Create `lib/audit-log-selectors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { filterAuditLog, type AuditLogFilters } from './audit-log-selectors';
import type { AuditLogEntry } from './audit-log-repository';

const baseFilters: AuditLogFilters = { query: '', actionFilter: 'all', entityTypeFilter: 'all', dateFrom: null, dateTo: null };

const entries: AuditLogEntry[] = [
  { id: 'log-1', actorId: 'user-1', actorEmail: 'sil@hhccs.com.au', action: 'create', entityType: 'bill', entityId: 'bill-1', entityLabel: 'Rent', beforeValue: null, afterValue: { amount: 1450 }, createdAt: '2026-08-10T10:00:00.000Z' },
  { id: 'log-2', actorId: 'user-1', actorEmail: 'sil@hhccs.com.au', action: 'delete', entityType: 'reminder', entityId: 'rem-1', entityLabel: 'Call bank', beforeValue: { title: 'Call bank' }, afterValue: null, createdAt: '2026-08-12T09:00:00.000Z' },
  { id: 'log-3', actorId: 'user-2', actorEmail: 'other@example.com', action: 'update', entityType: 'category', entityId: 'cat-1', entityLabel: 'Groceries', beforeValue: { colorSlot: 1 }, afterValue: { colorSlot: 2 }, createdAt: '2026-08-14T09:00:00.000Z' },
];

describe('filterAuditLog', () => {
  it('returns everything when every filter is at its default', () => {
    expect(filterAuditLog(entries, baseFilters)).toEqual(entries);
  });

  it('matches the query against the entity label', () => {
    const result = filterAuditLog(entries, { ...baseFilters, query: 'rent' });
    expect(result.map((e) => e.id)).toEqual(['log-1']);
  });

  it('matches the query against the actor email', () => {
    const result = filterAuditLog(entries, { ...baseFilters, query: 'other@example.com' });
    expect(result.map((e) => e.id)).toEqual(['log-3']);
  });

  it('filters by action', () => {
    const result = filterAuditLog(entries, { ...baseFilters, actionFilter: 'delete' });
    expect(result.map((e) => e.id)).toEqual(['log-2']);
  });

  it('filters by entity type', () => {
    const result = filterAuditLog(entries, { ...baseFilters, entityTypeFilter: 'category' });
    expect(result.map((e) => e.id)).toEqual(['log-3']);
  });

  it('filters by a date range', () => {
    const result = filterAuditLog(entries, { ...baseFilters, dateFrom: '2026-08-11', dateTo: '2026-08-13' });
    expect(result.map((e) => e.id)).toEqual(['log-2']);
  });

  it('combines multiple filters with AND semantics', () => {
    const result = filterAuditLog(entries, { ...baseFilters, actionFilter: 'update', entityTypeFilter: 'category', query: 'groceries' });
    expect(result.map((e) => e.id)).toEqual(['log-3']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/audit-log-selectors.test.ts`
Expected: FAIL — `Cannot find module './audit-log-selectors'`

- [ ] **Step 3: Write the implementation**

Create `lib/audit-log-selectors.ts`:

```ts
import type { AuditAction, AuditLogEntry } from './audit-log-repository';

export interface AuditLogFilters {
  query: string;
  actionFilter: AuditAction | 'all';
  entityTypeFilter: string;
  dateFrom: string | null;
  dateTo: string | null;
}

export function filterAuditLog(entries: AuditLogEntry[], filters: AuditLogFilters): AuditLogEntry[] {
  const q = filters.query.trim().toLowerCase();

  return entries.filter((entry) => {
    const matchesQuery = q === '' || entry.entityLabel.toLowerCase().includes(q) || entry.actorEmail.toLowerCase().includes(q);
    const matchesAction = filters.actionFilter === 'all' || entry.action === filters.actionFilter;
    const matchesEntityType = filters.entityTypeFilter === 'all' || entry.entityType === filters.entityTypeFilter;
    const entryDate = entry.createdAt.slice(0, 10);
    const matchesFrom = !filters.dateFrom || entryDate >= filters.dateFrom;
    const matchesTo = !filters.dateTo || entryDate <= filters.dateTo;
    return matchesQuery && matchesAction && matchesEntityType && matchesFrom && matchesTo;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/audit-log-selectors.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/audit-log-selectors.ts lib/audit-log-selectors.test.ts
git commit -m "feat: add filterAuditLog selector for the Activity Log"
```

---

### Task 2: `ActivityLogFilterBar` component

**Files:**
- Create: `components/activity/ActivityLogFilterBar.tsx`
- Create: `components/activity/ActivityLogFilterBar.test.tsx`

**Interfaces:**
- Consumes: `AuditAction` from `@/lib/audit-log-repository`.
- Produces: `ActivityLogFilterBar({ query, onQueryChange, actionFilter, onActionFilterChange, entityTypeFilter, onEntityTypeFilterChange, dateFrom, onDateFromChange, dateTo, onDateToChange })` — consumed by `ActivityLogList` (Task 3).

- [ ] **Step 1: Write the failing test**

Create `components/activity/ActivityLogFilterBar.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityLogFilterBar } from './ActivityLogFilterBar';

const noop = () => {};

describe('ActivityLogFilterBar', () => {
  it('calls onQueryChange when the search input changes', () => {
    const onQueryChange = vi.fn();
    render(
      <ActivityLogFilterBar
        query=""
        onQueryChange={onQueryChange}
        actionFilter="all"
        onActionFilterChange={noop}
        entityTypeFilter="all"
        onEntityTypeFilterChange={noop}
        dateFrom={null}
        onDateFromChange={noop}
        dateTo={null}
        onDateToChange={noop}
      />
    );
    fireEvent.change(screen.getByTestId('activity-search-input'), { target: { value: 'rent' } });
    expect(onQueryChange).toHaveBeenCalledWith('rent');
  });

  it('marks the active action chip as pressed', () => {
    render(
      <ActivityLogFilterBar
        query=""
        onQueryChange={noop}
        actionFilter="delete"
        onActionFilterChange={noop}
        entityTypeFilter="all"
        onEntityTypeFilterChange={noop}
        dateFrom={null}
        onDateFromChange={noop}
        dateTo={null}
        onDateToChange={noop}
      />
    );
    expect(screen.getByTestId('activity-filter-delete')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('activity-filter-all')).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onActionFilterChange when an action chip is clicked', () => {
    const onActionFilterChange = vi.fn();
    render(
      <ActivityLogFilterBar
        query=""
        onQueryChange={noop}
        actionFilter="all"
        onActionFilterChange={onActionFilterChange}
        entityTypeFilter="all"
        onEntityTypeFilterChange={noop}
        dateFrom={null}
        onDateFromChange={noop}
        dateTo={null}
        onDateToChange={noop}
      />
    );
    fireEvent.click(screen.getByTestId('activity-filter-create'));
    expect(onActionFilterChange).toHaveBeenCalledWith('create');
  });

  it('calls onEntityTypeFilterChange when the module select changes', () => {
    const onEntityTypeFilterChange = vi.fn();
    render(
      <ActivityLogFilterBar
        query=""
        onQueryChange={noop}
        actionFilter="all"
        onActionFilterChange={noop}
        entityTypeFilter="all"
        onEntityTypeFilterChange={onEntityTypeFilterChange}
        dateFrom={null}
        onDateFromChange={noop}
        dateTo={null}
        onDateToChange={noop}
      />
    );
    fireEvent.change(screen.getByTestId('activity-entity-type-select'), { target: { value: 'category' } });
    expect(onEntityTypeFilterChange).toHaveBeenCalledWith('category');
  });

  it('calls onDateFromChange and onDateToChange when the date inputs change', () => {
    const onDateFromChange = vi.fn();
    const onDateToChange = vi.fn();
    render(
      <ActivityLogFilterBar
        query=""
        onQueryChange={noop}
        actionFilter="all"
        onActionFilterChange={noop}
        entityTypeFilter="all"
        onEntityTypeFilterChange={noop}
        dateFrom={null}
        onDateFromChange={onDateFromChange}
        dateTo={null}
        onDateToChange={onDateToChange}
      />
    );
    fireEvent.change(screen.getByTestId('activity-date-from-input'), { target: { value: '2026-08-01' } });
    expect(onDateFromChange).toHaveBeenCalledWith('2026-08-01');
    fireEvent.change(screen.getByTestId('activity-date-to-input'), { target: { value: '2026-08-31' } });
    expect(onDateToChange).toHaveBeenCalledWith('2026-08-31');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/activity/ActivityLogFilterBar.test.tsx`
Expected: FAIL — `Cannot find module './ActivityLogFilterBar'`

- [ ] **Step 3: Write the implementation**

Create `components/activity/ActivityLogFilterBar.tsx`:

```tsx
'use client';

import type { AuditAction } from '@/lib/audit-log-repository';

const ACTION_FILTERS: { id: AuditAction | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'create', label: 'Created' },
  { id: 'update', label: 'Updated' },
  { id: 'delete', label: 'Deleted' },
  { id: 'upload', label: 'Uploaded' },
  { id: 'link', label: 'Linked' },
  { id: 'unlink', label: 'Unlinked' },
  { id: 'skip', label: 'Skipped' },
  { id: 'archive', label: 'Archived' },
  { id: 'unarchive', label: 'Unarchived' },
  { id: 'merge', label: 'Merged' },
];

const ENTITY_TYPE_FILTERS: { id: string; label: string }[] = [
  { id: 'all', label: 'All modules' },
  { id: 'bill', label: 'Bills' },
  { id: 'reminder', label: 'Reminders' },
  { id: 'credit_card_due', label: 'Cards' },
  { id: 'income_source', label: 'Income' },
  { id: 'category', label: 'Categories' },
  { id: 'receipt', label: 'Receipts' },
];

interface ActivityLogFilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  actionFilter: AuditAction | 'all';
  onActionFilterChange: (value: AuditAction | 'all') => void;
  entityTypeFilter: string;
  onEntityTypeFilterChange: (value: string) => void;
  dateFrom: string | null;
  onDateFromChange: (value: string | null) => void;
  dateTo: string | null;
  onDateToChange: (value: string | null) => void;
}

export function ActivityLogFilterBar({
  query,
  onQueryChange,
  actionFilter,
  onActionFilterChange,
  entityTypeFilter,
  onEntityTypeFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
}: ActivityLogFilterBarProps) {
  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        data-testid="activity-search-input"
        aria-label="Search activity"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search by item or actor"
        className="rounded-full border border-neutral-200 px-4 py-2 text-sm text-neutral-900 outline-none focus:border-gold"
      />
      <div data-testid="activity-filter-chips" className="flex flex-wrap gap-1.5">
        {ACTION_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            data-testid={`activity-filter-${filter.id}`}
            aria-pressed={actionFilter === filter.id}
            onClick={() => onActionFilterChange(filter.id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              actionFilter === filter.id ? 'border-gold bg-gold text-white' : 'border-neutral-200 text-neutral-600'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <select
          data-testid="activity-entity-type-select"
          aria-label="Filter by module"
          value={entityTypeFilter}
          onChange={(e) => onEntityTypeFilterChange(e.target.value)}
          className="min-h-11 rounded-full border border-neutral-200 px-2 text-xs text-neutral-600"
        >
          {ENTITY_TYPE_FILTERS.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          data-testid="activity-date-from-input"
          aria-label="From date"
          value={dateFrom ?? ''}
          onChange={(e) => onDateFromChange(e.target.value === '' ? null : e.target.value)}
          className="min-h-11 rounded-full border border-neutral-200 px-2 text-xs text-neutral-600"
        />
        <input
          type="date"
          data-testid="activity-date-to-input"
          aria-label="To date"
          value={dateTo ?? ''}
          onChange={(e) => onDateToChange(e.target.value === '' ? null : e.target.value)}
          className="min-h-11 rounded-full border border-neutral-200 px-2 text-xs text-neutral-600"
        />
      </div>
    </div>
  );
}
```

Note the `min-h-11` on the select/date inputs — this session's earlier audit already established that pattern for tappable controls; carrying it forward here rather than shipping another under-sized touch target.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/activity/ActivityLogFilterBar.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add components/activity/ActivityLogFilterBar.tsx components/activity/ActivityLogFilterBar.test.tsx
git commit -m "feat: add ActivityLogFilterBar component"
```

---

### Task 3: Wire filtering into `ActivityLogList`

**Files:**
- Modify: `components/activity/ActivityLogList.tsx`
- Modify: `components/activity/ActivityLogList.test.tsx`

**Interfaces:**
- Consumes: `filterAuditLog`, `AuditLogFilters` from `@/lib/audit-log-selectors` (Task 1); `ActivityLogFilterBar` from `./ActivityLogFilterBar` (Task 2).
- No change to `ActivityLogList`'s own props (`{ entries: AuditLogEntry[] }`) — the `/activity` page (Phase 1) needs no changes at all.

- [ ] **Step 1: Write the failing tests**

Replace the existing `it('shows an empty state when there are no entries', ...)` test in `components/activity/ActivityLogList.test.tsx` with:

```tsx
  it('shows an empty state when there are no entries', () => {
    render(<ActivityLogList entries={[]} />);
    expect(screen.getByTestId('empty-state')).toHaveTextContent('No activity matches your filters.');
  });
```

(only the expected message text changes, per this plan's Global Constraints)

Add these tests after the existing `'renders one tile per entry'` test:

```tsx
  it('filters entries by search query', () => {
    render(<ActivityLogList entries={entries} />);
    fireEvent.change(screen.getByTestId('activity-search-input'), { target: { value: 'rent' } });
    expect(screen.getAllByTestId('activity-log-entry')).toHaveLength(1);
  });

  it('filters entries by action chip', () => {
    render(<ActivityLogList entries={entries} />);
    fireEvent.click(screen.getByTestId('activity-filter-delete'));
    expect(screen.getAllByTestId('activity-log-entry')).toHaveLength(1);
  });

  it('filters entries by module', () => {
    render(<ActivityLogList entries={entries} />);
    fireEvent.change(screen.getByTestId('activity-entity-type-select'), { target: { value: 'reminder' } });
    expect(screen.getAllByTestId('activity-log-entry')).toHaveLength(1);
  });

  it('shows the no-matches empty state when filters exclude every entry', () => {
    render(<ActivityLogList entries={entries} />);
    fireEvent.change(screen.getByTestId('activity-search-input'), { target: { value: 'nonexistent' } });
    expect(screen.getByTestId('empty-state')).toHaveTextContent('No activity matches your filters.');
  });
```

(add `fireEvent` to the existing `@testing-library/react` import, and add a second `AuditLogEntry` to the module-level `entries` fixture so filtering has something to narrow down — replace the existing two-entry `entries` array with:)

```tsx
const entries: AuditLogEntry[] = [
  { id: 'log-1', actorId: 'user-1', actorEmail: 'a@b.com', action: 'create', entityType: 'bill', entityId: 'bill-1', entityLabel: 'Rent', beforeValue: null, afterValue: { amount: 100 }, createdAt: '2026-08-12T10:00:00.000Z' },
  { id: 'log-2', actorId: 'user-1', actorEmail: 'a@b.com', action: 'delete', entityType: 'reminder', entityId: 'rem-1', entityLabel: 'Call bank', beforeValue: { title: 'Call bank' }, afterValue: null, createdAt: '2026-08-12T09:00:00.000Z' },
];
```

(this is the same fixture already in the file — no change needed there, listed here only to confirm the two entries already differ enough in label/action/entityType for the new filter tests to be meaningful)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run components/activity/ActivityLogList.test.tsx`
Expected: FAIL — the empty-state message doesn't match yet, and the filter inputs/chips don't exist yet.

- [ ] **Step 3: Update the implementation**

Replace `components/activity/ActivityLogList.tsx` with:

```tsx
'use client';

import { useMemo, useState } from 'react';
import type { AuditAction, AuditLogEntry } from '@/lib/audit-log-repository';
import { filterAuditLog } from '@/lib/audit-log-selectors';
import { ActivityLogEntryTile } from './ActivityLogEntryTile';
import { ActivityLogFilterBar } from './ActivityLogFilterBar';
import { EmptyState } from '@/components/shared/EmptyState';

export function ActivityLogList({ entries }: { entries: AuditLogEntry[] }) {
  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<AuditAction | 'all'>('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);

  const visibleEntries = useMemo(
    () => filterAuditLog(entries, { query, actionFilter, entityTypeFilter, dateFrom, dateTo }),
    [entries, query, actionFilter, entityTypeFilter, dateFrom, dateTo]
  );

  return (
    <div data-testid="activity-log-list" className="flex flex-col gap-3">
      <ActivityLogFilterBar
        query={query}
        onQueryChange={setQuery}
        actionFilter={actionFilter}
        onActionFilterChange={setActionFilter}
        entityTypeFilter={entityTypeFilter}
        onEntityTypeFilterChange={setEntityTypeFilter}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
      />
      {visibleEntries.length === 0 ? (
        <EmptyState message="No activity matches your filters." />
      ) : (
        <div className="flex flex-col gap-2">
          {visibleEntries.map((entry) => (
            <ActivityLogEntryTile key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run components/activity/ActivityLogList.test.tsx`
Expected: PASS (all pre-existing tests, updated, plus the 4 new ones)

- [ ] **Step 5: Run the `/activity` page test to verify no regression**

Run: `npx vitest run "app/(shell)/activity/page.test.tsx"`
Expected: PASS (unchanged — the page passes raw `entries` straight through, exactly as before)

- [ ] **Step 6: Commit**

```bash
git add components/activity/ActivityLogList.tsx components/activity/ActivityLogList.test.tsx
git commit -m "feat: add search and filter to the Activity Log"
```

---

### Task 4: Full suite verification

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

Not executable in this environment — flag to the user: once migration `0013_audit_log.sql` is applied and some real activity has accumulated, open `/activity` and confirm search, the action chips, the module select, and the date range all narrow the list correctly, and clear back to showing everything when reset. This closes out every requirement from the original 2026-08-07 Activity Log request.
