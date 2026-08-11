# Tile UI Revamp — Phase 2 (Bills + Reminders) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `BillRow`/`ReminderRow`'s horizontal-list rendering with `BillTile`/`ReminderTile`, laid out in the shared `TileGrid` 2-column grid, per the approved tile UI revamp design.

**Architecture:** `BillTile`/`ReminderTile` keep the exact same props, status logic, and `data-testid`s as the rows they replace (per the design spec's testing convention — no mechanical testid-rename churn). Only the internal layout changes: horizontal row → vertical tile card, and the status-tint background moves from `/5` opacity with a left border accent to `/10` opacity with no border, matching the tint already used by `BillStatusBadge`/`PriorityBadge` and the Phase 1 `LauncherTiles`. `BillsListView`/`RemindersListView` swap their `flex flex-col` wrapper for the shared `TileGrid`.

**Tech Stack:** React 19, TypeScript, Tailwind v4, vitest + @testing-library/react + @testing-library/user-event.

## Global Constraints

- Presentation-only change — no repository, hook, or Supabase migration touches anything in this phase.
- Keep `data-testid="bill-row"` / `data-testid="reminder-row"` unchanged (existing `BillsListView`/`RemindersListView` tests query them and must keep passing without modification).
- Tap targets stay at the existing 44px minimum already enforced on `bill-paid-toggle`/`reminder-complete-toggle`/`RowActionsMenu`'s trigger — this phase doesn't touch those elements' sizing, only their position in the layout.

---

### Task 1: `BillTile` replaces `BillRow`

**Files:**
- Create: `components/bills/BillTile.tsx`
- Create: `components/bills/BillTile.test.tsx`
- Delete: `components/bills/BillRow.tsx`
- Delete: `components/bills/BillRow.test.tsx`

**Interfaces:**
- Consumes: `Bill`, `BillStatus` from `@/lib/bills-types`; `getBillStatus` from `@/lib/bills-selectors`; `BillStatusBadge` from `./BillStatusBadge`; `RowActionsMenu` from `@/components/shared/RowActionsMenu`; `formatRelativeDate` from `@/lib/date-utils`.
- Produces: `BillTile({ bill, onTogglePaid, referenceDate?, isDuplicate?, onEdit?, onDelete?, onSkip? })` — identical prop shape to the old `BillRow`, so Task 3 is a drop-in import swap.

- [ ] **Step 1: Write the failing test**

Create `components/bills/BillTile.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BillTile } from './BillTile';
import type { Bill } from '@/lib/bills-types';

const referenceDate = new Date(2026, 7, 15);

const bill: Bill = {
  id: '1',
  title: 'Internet Bill',
  category: 'Utilities',
  amount: 59.99,
  dueDate: '2026-08-15',
  recurrence: 'monthly',
  paid: false,
  seriesId: null,
  cycleNumber: null,
  skipped: false,
};

describe('BillTile', () => {
  it('shows title, category, amount, and recurrence badge', () => {
    render(<BillTile bill={bill} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    const tile = screen.getByTestId('bill-row');
    expect(tile).toHaveTextContent('Internet Bill');
    expect(tile).toHaveTextContent('Utilities');
    expect(tile).toHaveTextContent('₱59.99');
    expect(tile).toHaveTextContent('Monthly');
  });

  it('does not show a recurrence badge for a non-recurring bill', () => {
    const oneOff: Bill = { ...bill, recurrence: null };
    render(<BillTile bill={oneOff} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('bill-row')).not.toHaveTextContent('Monthly');
  });

  it('calls onTogglePaid with the bill id when the toggle is clicked', () => {
    const onTogglePaid = vi.fn();
    render(<BillTile bill={bill} onTogglePaid={onTogglePaid} referenceDate={referenceDate} />);
    fireEvent.click(screen.getByTestId('bill-paid-toggle'));
    expect(onTogglePaid).toHaveBeenCalledWith('1');
  });

  it('shows the paid toggle as pressed when the bill is paid', () => {
    const paidBill: Bill = { ...bill, paid: true };
    render(<BillTile bill={paidBill} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('bill-paid-toggle')).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows a possible-duplicate warning when isDuplicate is true', () => {
    render(<BillTile bill={bill} onTogglePaid={vi.fn()} referenceDate={referenceDate} isDuplicate />);
    expect(screen.getByTestId('bill-duplicate-warning')).toHaveTextContent('Possible duplicate');
  });

  it('does not show a duplicate warning by default', () => {
    render(<BillTile bill={bill} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.queryByTestId('bill-duplicate-warning')).not.toBeInTheDocument();
  });

  it('tints the amount and card background to match status: overdue', () => {
    const overdue: Bill = { ...bill, dueDate: '2026-08-01' };
    render(<BillTile bill={overdue} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('bill-amount')).toHaveClass('text-status-critical');
    expect(screen.getByTestId('bill-row')).toHaveClass('bg-status-critical/10');
  });

  it('tints the amount and card background to match status: paid', () => {
    const paidBill: Bill = { ...bill, paid: true };
    render(<BillTile bill={paidBill} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('bill-amount')).toHaveClass('text-status-success');
    expect(screen.getByTestId('bill-row')).toHaveClass('bg-status-success/10');
  });

  it('uses a neutral gray background for a bill that is merely upcoming', () => {
    const upcoming: Bill = { ...bill, dueDate: '2026-09-01' };
    render(<BillTile bill={upcoming} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('bill-row')).toHaveClass('bg-neutral-100');
  });

  it('does not render an actions menu when no handlers are given', () => {
    render(<BillTile bill={bill} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.queryByRole('button', { name: /actions for internet bill/i })).not.toBeInTheDocument();
  });

  it('hides Edit/Delete until the actions menu is opened', () => {
    render(<BillTile bill={bill} onTogglePaid={vi.fn()} referenceDate={referenceDate} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole('button', { name: /actions for internet bill/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('calls onEdit/onDelete via the actions menu', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<BillTile bill={bill} onTogglePaid={vi.fn()} referenceDate={referenceDate} onEdit={onEdit} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /actions for internet bill/i }));
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(bill);

    await user.click(screen.getByRole('button', { name: /actions for internet bill/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(bill);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/bills/BillTile.test.tsx`
Expected: FAIL — `Cannot find module './BillTile'`

- [ ] **Step 3: Write the implementation**

Create `components/bills/BillTile.tsx`:

```tsx
import type { Bill, BillStatus } from '@/lib/bills-types';
import { getBillStatus } from '@/lib/bills-selectors';
import { BillStatusBadge } from './BillStatusBadge';
import { RowActionsMenu } from '@/components/shared/RowActionsMenu';
import { formatRelativeDate } from '@/lib/date-utils';

const RECURRENCE_LABEL: Record<NonNullable<Bill['recurrence']>, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

const STATUS_TINT: Record<BillStatus, string> = {
  overdue: 'bg-status-critical/10',
  'due-soon': 'bg-status-warning/10',
  paid: 'bg-status-success/10',
  upcoming: 'bg-neutral-100',
};

const STATUS_AMOUNT_COLOR: Record<BillStatus, string> = {
  overdue: 'text-status-critical',
  'due-soon': 'text-status-warning',
  paid: 'text-status-success',
  upcoming: 'text-neutral-900',
};

interface BillTileProps {
  bill: Bill;
  onTogglePaid: (id: string) => void;
  referenceDate?: Date;
  isDuplicate?: boolean;
  onEdit?: (bill: Bill) => void;
  onDelete?: (bill: Bill) => void;
  onSkip?: (bill: Bill) => void;
}

export function BillTile({ bill, onTogglePaid, referenceDate = new Date(), isDuplicate = false, onEdit, onDelete, onSkip }: BillTileProps) {
  const status = getBillStatus(bill, referenceDate);

  return (
    <div data-testid="bill-row" className={`flex flex-col gap-2 rounded-2xl p-4 ${STATUS_TINT[status]}`}>
      {isDuplicate && (
        <p data-testid="bill-duplicate-warning" className="text-[10px] font-medium text-status-warning">
          Possible duplicate — check for a matching bill nearby
        </p>
      )}
      <div className="flex items-center justify-between">
        <button
          type="button"
          data-testid="bill-paid-toggle"
          aria-label={bill.paid ? 'Mark as unpaid' : 'Mark as paid'}
          aria-pressed={bill.paid}
          onClick={() => onTogglePaid(bill.id)}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
            bill.paid ? 'border-status-success bg-status-success text-white' : 'border-neutral-300 text-transparent'
          }`}
        >
          ✓
        </button>
        <RowActionsMenu
          label={bill.title}
          onEdit={onEdit ? () => onEdit(bill) : undefined}
          onDelete={onDelete ? () => onDelete(bill) : undefined}
          onSkip={onSkip && bill.seriesId && !bill.paid ? () => onSkip(bill) : undefined}
        />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-neutral-900">{bill.title}</p>
          {bill.recurrence && (
            <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] text-neutral-500">
              {RECURRENCE_LABEL[bill.recurrence]}
            </span>
          )}
        </div>
        <p className="text-xs text-neutral-500">
          {bill.category} · {formatRelativeDate(bill.dueDate, referenceDate)}
        </p>
      </div>
      <div className="flex items-center justify-between">
        <span data-testid="bill-amount" className={`font-serif text-sm ${STATUS_AMOUNT_COLOR[status]}`}>
          ₱{bill.amount.toFixed(2)}
        </span>
        <BillStatusBadge status={status} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/bills/BillTile.test.tsx`
Expected: PASS (12 tests)

- [ ] **Step 5: Delete the old row component**

```bash
git rm components/bills/BillRow.tsx components/bills/BillRow.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add components/bills/BillTile.tsx components/bills/BillTile.test.tsx
git commit -m "feat: replace BillRow with BillTile for the tile UI revamp"
```

---

### Task 2: `ReminderTile` replaces `ReminderRow`

**Files:**
- Create: `components/reminders/ReminderTile.tsx`
- Create: `components/reminders/ReminderTile.test.tsx`
- Delete: `components/reminders/ReminderRow.tsx`
- Delete: `components/reminders/ReminderRow.test.tsx`

**Interfaces:**
- Consumes: `Priority`, `Reminder` from `@/lib/reminders-types`; `PriorityBadge` from `./PriorityBadge`; `RowActionsMenu` from `@/components/shared/RowActionsMenu`; `formatRelativeDate` from `@/lib/date-utils`.
- Produces: `ReminderTile({ reminder, onToggleComplete, onSnooze, referenceDate?, onEdit?, onDelete?, onSkip? })` — identical prop shape to the old `ReminderRow`.

- [ ] **Step 1: Write the failing test**

Create `components/reminders/ReminderTile.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReminderTile } from './ReminderTile';
import type { Reminder } from '@/lib/reminders-types';

const referenceDate = new Date(2026, 7, 15);

const reminder: Reminder = {
  id: '1',
  title: 'Call insurance provider',
  category: 'Finance',
  dueDate: '2026-08-15',
  priority: 'high',
  completed: false,
  seriesId: null,
  cycleNumber: null,
  skipped: false,
};

describe('ReminderTile', () => {
  it('shows title, category, and priority badge', () => {
    render(<ReminderTile reminder={reminder} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    const tile = screen.getByTestId('reminder-row');
    expect(tile).toHaveTextContent('Call insurance provider');
    expect(tile).toHaveTextContent('Finance');
    expect(tile).toHaveTextContent('High');
  });

  it('applies strikethrough styling when completed', () => {
    const completed: Reminder = { ...reminder, completed: true };
    render(<ReminderTile reminder={completed} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('reminder-title').className).toContain('line-through');
  });

  it('calls onToggleComplete with the reminder id when the toggle is clicked', () => {
    const onToggleComplete = vi.fn();
    render(<ReminderTile reminder={reminder} onToggleComplete={onToggleComplete} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    fireEvent.click(screen.getByTestId('reminder-complete-toggle'));
    expect(onToggleComplete).toHaveBeenCalledWith('1');
  });

  it('calls onSnooze with the reminder id when Snooze is clicked', () => {
    const onSnooze = vi.fn();
    render(<ReminderTile reminder={reminder} onToggleComplete={vi.fn()} onSnooze={onSnooze} referenceDate={referenceDate} />);
    fireEvent.click(screen.getByTestId('reminder-snooze-button'));
    expect(onSnooze).toHaveBeenCalledWith('1');
  });

  it('hides the Snooze button once the reminder is completed', () => {
    const completed: Reminder = { ...reminder, completed: true };
    render(<ReminderTile reminder={completed} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.queryByTestId('reminder-snooze-button')).not.toBeInTheDocument();
  });

  it('tints the card background to match priority: high', () => {
    render(<ReminderTile reminder={reminder} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('reminder-row')).toHaveClass('bg-status-critical/10');
  });

  it('uses a neutral gray background for priority: low', () => {
    const low: Reminder = { ...reminder, priority: 'low' };
    render(<ReminderTile reminder={low} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('reminder-row')).toHaveClass('bg-neutral-100');
  });

  it('tints the card background green once completed, regardless of priority', () => {
    const completed: Reminder = { ...reminder, completed: true };
    render(<ReminderTile reminder={completed} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('reminder-row')).toHaveClass('bg-status-success/10');
  });

  it('calls onEdit/onDelete via the actions menu', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(
      <ReminderTile reminder={reminder} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} onEdit={onEdit} onDelete={onDelete} />
    );

    await user.click(screen.getByRole('button', { name: /actions for call insurance provider/i }));
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(reminder);

    await user.click(screen.getByRole('button', { name: /actions for call insurance provider/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(reminder);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/reminders/ReminderTile.test.tsx`
Expected: FAIL — `Cannot find module './ReminderTile'`

- [ ] **Step 3: Write the implementation**

Create `components/reminders/ReminderTile.tsx`:

```tsx
import type { Priority, Reminder } from '@/lib/reminders-types';
import { PriorityBadge } from './PriorityBadge';
import { RowActionsMenu } from '@/components/shared/RowActionsMenu';
import { formatRelativeDate } from '@/lib/date-utils';

const PRIORITY_TINT: Record<Priority, string> = {
  high: 'bg-status-critical/10',
  medium: 'bg-status-warning/10',
  low: 'bg-neutral-100',
};

interface ReminderTileProps {
  reminder: Reminder;
  onToggleComplete: (id: string) => void;
  onSnooze: (id: string) => void;
  referenceDate?: Date;
  onEdit?: (reminder: Reminder) => void;
  onDelete?: (reminder: Reminder) => void;
  onSkip?: (reminder: Reminder) => void;
}

export function ReminderTile({ reminder, onToggleComplete, onSnooze, referenceDate = new Date(), onEdit, onDelete, onSkip }: ReminderTileProps) {
  return (
    <div
      data-testid="reminder-row"
      className={`flex flex-col gap-2 rounded-2xl p-4 ${reminder.completed ? 'bg-status-success/10' : PRIORITY_TINT[reminder.priority]}`}
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          data-testid="reminder-complete-toggle"
          aria-label={reminder.completed ? 'Mark as not done' : 'Mark as done'}
          aria-pressed={reminder.completed}
          onClick={() => onToggleComplete(reminder.id)}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
            reminder.completed
              ? 'border-status-success bg-status-success text-white'
              : 'border-neutral-300 text-transparent'
          }`}
        >
          ✓
        </button>
        <RowActionsMenu
          label={reminder.title}
          onEdit={onEdit ? () => onEdit(reminder) : undefined}
          onDelete={onDelete ? () => onDelete(reminder) : undefined}
          onSkip={onSkip && reminder.seriesId && !reminder.completed ? () => onSkip(reminder) : undefined}
        />
      </div>
      <div>
        <p
          data-testid="reminder-title"
          className={`text-sm font-medium text-neutral-900 ${reminder.completed ? 'line-through text-neutral-400' : ''}`}
        >
          {reminder.title}
        </p>
        <p className="text-xs text-neutral-500">
          {reminder.category} · {formatRelativeDate(reminder.dueDate, referenceDate)}
        </p>
      </div>
      <div className="flex items-center justify-between">
        <PriorityBadge priority={reminder.priority} />
        {!reminder.completed && (
          <button
            type="button"
            data-testid="reminder-snooze-button"
            onClick={() => onSnooze(reminder.id)}
            className="rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] font-medium text-neutral-600"
          >
            Snooze
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/reminders/ReminderTile.test.tsx`
Expected: PASS (8 tests)

- [ ] **Step 5: Delete the old row component**

```bash
git rm components/reminders/ReminderRow.tsx components/reminders/ReminderRow.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add components/reminders/ReminderTile.tsx components/reminders/ReminderTile.test.tsx
git commit -m "feat: replace ReminderRow with ReminderTile for the tile UI revamp"
```

---

### Task 3: Wire `BillTile` into `BillsListView` via `TileGrid`

**Files:**
- Modify: `components/bills/BillsListView.tsx`

**Interfaces:**
- Consumes: `BillTile` from `./BillTile` (Task 1); `TileGrid` from `@/components/shared/TileGrid` (already exists from Phase 1).
- No prop or testid changes — `BillsListView.test.tsx` requires no edits.

- [ ] **Step 1: Confirm the existing test still describes the target behavior**

Read `components/bills/BillsListView.test.tsx` — it asserts `getAllByTestId('bill-row')` counts and section dot colors, none of which change. No test edits needed for this task.

- [ ] **Step 2: Update the implementation**

In `components/bills/BillsListView.tsx`, replace the import and the per-section rendering:

```tsx
import { BillTile } from './BillTile';
import { TileGrid } from '@/components/shared/TileGrid';
```

(replaces `import { BillRow } from './BillRow';`)

```tsx
                  <TileGrid testId={`bills-tile-grid-${status}`}>
                    {grouped[status].map((bill) => (
                      <BillTile
                        key={bill.id}
                        bill={bill}
                        onTogglePaid={onTogglePaid}
                        referenceDate={referenceDate}
                        isDuplicate={duplicateIds.has(bill.id)}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onSkip={onSkip}
                      />
                    ))}
                  </TileGrid>
```

(replaces the `<div className="flex flex-col gap-2">...</div>` wrapper around the `BillRow` map)

- [ ] **Step 3: Run the existing test to verify no regression**

Run: `npx vitest run components/bills/BillsListView.test.tsx`
Expected: PASS (7 tests, unchanged)

- [ ] **Step 4: Commit**

```bash
git add components/bills/BillsListView.tsx
git commit -m "feat: render bills as a tile grid in BillsListView"
```

---

### Task 4: Wire `ReminderTile` into `RemindersListView` via `TileGrid`

**Files:**
- Modify: `components/reminders/RemindersListView.tsx`

**Interfaces:**
- Consumes: `ReminderTile` from `./ReminderTile` (Task 2); `TileGrid` from `@/components/shared/TileGrid`.
- No prop or testid changes — `RemindersListView.test.tsx` requires no edits.

- [ ] **Step 1: Confirm the existing test still describes the target behavior**

Read `components/reminders/RemindersListView.test.tsx` — it asserts `getAllByTestId('reminder-row')` counts only. No test edits needed for this task.

- [ ] **Step 2: Update the implementation**

In `components/reminders/RemindersListView.tsx`, replace the import and the list rendering:

```tsx
import { ReminderTile } from './ReminderTile';
import { TileGrid } from '@/components/shared/TileGrid';
```

(replaces `import { ReminderRow } from './ReminderRow';`)

```tsx
        <TileGrid testId="reminders-tile-grid">
          {visibleReminders.map((reminder) => (
            <ReminderTile
              key={reminder.id}
              reminder={reminder}
              onToggleComplete={onToggleComplete}
              onSnooze={onSnooze}
              referenceDate={referenceDate}
              onEdit={onEdit}
              onDelete={onDelete}
              onSkip={onSkip}
            />
          ))}
        </TileGrid>
```

(replaces the `<div className="flex flex-col gap-2">...</div>` wrapper around the `ReminderRow` map)

- [ ] **Step 3: Run the existing test to verify no regression**

Run: `npx vitest run components/reminders/RemindersListView.test.tsx`
Expected: PASS (4 tests, unchanged)

- [ ] **Step 4: Commit**

```bash
git add components/reminders/RemindersListView.tsx
git commit -m "feat: render reminders as a tile grid in RemindersListView"
```

---

### Task 5: Full suite verification

**Files:** None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All test files pass (no other file references `BillRow`/`ReminderRow`).

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

Not executable in this environment — flag to the user: open `/bills` and `/reminders` in a browser and confirm the 2-column tile grid renders correctly at mobile width, tap targets are comfortable, and Edit/Delete/Snooze/paid-toggle all still work.
