# Tile UI Revamp — Phase 3 (Accounts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `CardDueRow`/`IncomeRow`'s horizontal-list rendering with `CardDueTile`/`IncomeTile`, laid out in the shared `TileGrid` 2-column grid on the Accounts page, per the approved tile UI revamp design and the pattern established in Phase 2 (Bills/Reminders).

**Architecture:** Same approach as Phase 2: `CardDueTile`/`IncomeTile` keep the exact same props, status logic, and `data-testid`s (`card-due-row`, `card-due-balance`, `income-row`) as the rows they replace. Only the internal layout changes: horizontal row → vertical tile card, and status tint moves from `/5` opacity + left border to `/10` opacity with no border (matching `CardDueStatusBadge`'s existing tint and Phase 2's `BillTile`/`ReminderTile`). `AccountsPage` swaps its `flex flex-col gap-2` wrappers for `TileGrid`, once each for the Credit Card Dues section and the Income section.

**Tech Stack:** React 19, TypeScript, Tailwind v4, vitest + @testing-library/react + @testing-library/user-event.

## Global Constraints

- Presentation-only change — no repository, hook, or Supabase migration touches anything in this phase.
- Keep `data-testid="card-due-row"` / `data-testid="income-row"` unchanged (`app/(shell)/accounts/page.test.tsx` queries them via `getAllByTestId` and must keep passing without modification).
- Tap targets stay at the existing 44px minimum already enforced on `RowActionsMenu`'s trigger — this phase doesn't touch its sizing, only its position in the layout.

---

### Task 1: `CardDueTile` replaces `CardDueRow`

**Files:**
- Create: `components/accounts/CardDueTile.tsx`
- Create: `components/accounts/CardDueTile.test.tsx`
- Delete: `components/accounts/CardDueRow.tsx`
- Delete: `components/accounts/CardDueRow.test.tsx`

**Interfaces:**
- Consumes: `CreditCardDue`, `DueStatus` from `@/lib/accounts-types`; `getDueStatus` from `@/lib/accounts-selectors`; `CardDueStatusBadge` from `./CardDueStatusBadge`; `RowActionsMenu` from `@/components/shared/RowActionsMenu`; `formatRelativeDate` from `@/lib/date-utils`.
- Produces: `CardDueTile({ card, referenceDate?, onEdit?, onDelete? })` — identical prop shape to the old `CardDueRow`, so Task 3 is a drop-in import swap.

- [ ] **Step 1: Write the failing test**

Create `components/accounts/CardDueTile.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardDueTile } from './CardDueTile';
import type { CreditCardDue } from '@/lib/accounts-types';

const referenceDate = new Date(2026, 7, 15);

const card: CreditCardDue = {
  id: '1',
  cardName: 'Visa Platinum',
  last4: '4821',
  statementBalance: 842.5,
  minimumPayment: 45,
  dueDate: '2026-08-16',
};

describe('CardDueTile', () => {
  it('shows card name, masked last 4 digits, statement balance, and minimum payment', () => {
    render(<CardDueTile card={card} referenceDate={referenceDate} />);
    const tile = screen.getByTestId('card-due-row');
    expect(tile).toHaveTextContent('Visa Platinum');
    expect(tile).toHaveTextContent('••4821');
    expect(tile).toHaveTextContent('₱842.50');
    expect(tile).toHaveTextContent('₱45.00');
  });

  it('shows the due status badge', () => {
    render(<CardDueTile card={card} referenceDate={referenceDate} />);
    expect(screen.getByTestId('card-due-status-badge')).toBeInTheDocument();
  });

  it('tints the balance and card background to match status: overdue', () => {
    const overdue: CreditCardDue = { ...card, dueDate: '2026-08-01' };
    render(<CardDueTile card={overdue} referenceDate={referenceDate} />);
    expect(screen.getByTestId('card-due-balance')).toHaveClass('text-status-critical');
    expect(screen.getByTestId('card-due-row')).toHaveClass('bg-status-critical/10');
  });

  it('tints the balance to match status: due-soon', () => {
    const dueSoon: CreditCardDue = { ...card, dueDate: '2026-08-16' };
    render(<CardDueTile card={dueSoon} referenceDate={referenceDate} />);
    expect(screen.getByTestId('card-due-balance')).toHaveClass('text-status-warning');
    expect(screen.getByTestId('card-due-row')).toHaveClass('bg-status-warning/10');
  });

  it('uses a neutral gray background for status: upcoming', () => {
    const upcoming: CreditCardDue = { ...card, dueDate: '2026-09-30' };
    render(<CardDueTile card={upcoming} referenceDate={referenceDate} />);
    expect(screen.getByTestId('card-due-row')).toHaveClass('bg-neutral-100');
  });

  it('does not render an actions menu when no handlers are given', () => {
    render(<CardDueTile card={card} referenceDate={referenceDate} />);
    expect(screen.queryByRole('button', { name: /actions for visa platinum/i })).not.toBeInTheDocument();
  });

  it('calls onEdit/onDelete via the actions menu', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<CardDueTile card={card} referenceDate={referenceDate} onEdit={onEdit} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /actions for visa platinum/i }));
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(card);

    await user.click(screen.getByRole('button', { name: /actions for visa platinum/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(card);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/accounts/CardDueTile.test.tsx`
Expected: FAIL — `Cannot find module './CardDueTile'`

- [ ] **Step 3: Write the implementation**

Create `components/accounts/CardDueTile.tsx`:

```tsx
import type { CreditCardDue, DueStatus } from '@/lib/accounts-types';
import { getDueStatus } from '@/lib/accounts-selectors';
import { CardDueStatusBadge } from './CardDueStatusBadge';
import { RowActionsMenu } from '@/components/shared/RowActionsMenu';
import { formatRelativeDate } from '@/lib/date-utils';

const STATUS_TINT: Record<DueStatus, string> = {
  overdue: 'bg-status-critical/10',
  'due-soon': 'bg-status-warning/10',
  upcoming: 'bg-neutral-100',
};

const STATUS_BALANCE_COLOR: Record<DueStatus, string> = {
  overdue: 'text-status-critical',
  'due-soon': 'text-status-warning',
  upcoming: 'text-neutral-900',
};

interface CardDueTileProps {
  card: CreditCardDue;
  referenceDate?: Date;
  onEdit?: (card: CreditCardDue) => void;
  onDelete?: (card: CreditCardDue) => void;
}

export function CardDueTile({ card, referenceDate = new Date(), onEdit, onDelete }: CardDueTileProps) {
  const status = getDueStatus(card, referenceDate);

  return (
    <div data-testid="card-due-row" className={`flex flex-col gap-2 rounded-2xl p-4 ${STATUS_TINT[status]}`}>
      <div className="flex items-center justify-end">
        <RowActionsMenu
          label={card.cardName}
          onEdit={onEdit ? () => onEdit(card) : undefined}
          onDelete={onDelete ? () => onDelete(card) : undefined}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-neutral-900">{card.cardName}</p>
        <p className="text-xs text-neutral-500">
          ••{card.last4} · {formatRelativeDate(card.dueDate, referenceDate)}
        </p>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span data-testid="card-due-balance" className={`font-serif text-sm ${STATUS_BALANCE_COLOR[status]}`}>
            ₱{card.statementBalance.toFixed(2)}
          </span>
          <span className="text-[10px] text-neutral-400">Min ₱{card.minimumPayment.toFixed(2)}</span>
        </div>
        <CardDueStatusBadge status={status} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/accounts/CardDueTile.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 5: Delete the old row component**

```bash
git rm components/accounts/CardDueRow.tsx components/accounts/CardDueRow.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add components/accounts/CardDueTile.tsx components/accounts/CardDueTile.test.tsx
git commit -m "feat: replace CardDueRow with CardDueTile for the tile UI revamp"
```

---

### Task 2: `IncomeTile` replaces `IncomeRow`

**Files:**
- Create: `components/accounts/IncomeTile.tsx`
- Create: `components/accounts/IncomeTile.test.tsx`
- Delete: `components/accounts/IncomeRow.tsx`
- Delete: `components/accounts/IncomeRow.test.tsx`

**Interfaces:**
- Consumes: `IncomeSource` from `@/lib/accounts-types`; `RowActionsMenu` from `@/components/shared/RowActionsMenu`; `formatRelativeDate` from `@/lib/date-utils`.
- Produces: `IncomeTile({ source, referenceDate?, onEdit?, onDelete? })` — identical prop shape to the old `IncomeRow`.

- [ ] **Step 1: Write the failing test**

Create `components/accounts/IncomeTile.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IncomeTile } from './IncomeTile';
import type { IncomeSource } from '@/lib/accounts-types';

const referenceDate = new Date(2026, 7, 15);

const source: IncomeSource = {
  id: '1',
  name: 'Salary',
  amount: 3200,
  frequency: 'biweekly',
  nextDate: '2026-08-20',
};

describe('IncomeTile', () => {
  it('shows name, amount, frequency, and next date', () => {
    render(<IncomeTile source={source} referenceDate={referenceDate} />);
    const tile = screen.getByTestId('income-row');
    expect(tile).toHaveTextContent('Salary');
    expect(tile).toHaveTextContent('₱3200.00');
    expect(tile).toHaveTextContent('Biweekly');
  });

  it('tints the card background success-green', () => {
    render(<IncomeTile source={source} referenceDate={referenceDate} />);
    expect(screen.getByTestId('income-row')).toHaveClass('bg-status-success/10');
  });

  it('calls onEdit/onDelete via the actions menu', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<IncomeTile source={source} referenceDate={referenceDate} onEdit={onEdit} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /actions for salary/i }));
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(source);

    await user.click(screen.getByRole('button', { name: /actions for salary/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(source);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/accounts/IncomeTile.test.tsx`
Expected: FAIL — `Cannot find module './IncomeTile'`

- [ ] **Step 3: Write the implementation**

Create `components/accounts/IncomeTile.tsx`:

```tsx
import type { IncomeSource } from '@/lib/accounts-types';
import { RowActionsMenu } from '@/components/shared/RowActionsMenu';
import { formatRelativeDate } from '@/lib/date-utils';

const FREQUENCY_LABEL: Record<IncomeSource['frequency'], string> = {
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
};

interface IncomeTileProps {
  source: IncomeSource;
  referenceDate?: Date;
  onEdit?: (source: IncomeSource) => void;
  onDelete?: (source: IncomeSource) => void;
}

export function IncomeTile({ source, referenceDate = new Date(), onEdit, onDelete }: IncomeTileProps) {
  return (
    <div data-testid="income-row" className="flex flex-col gap-2 rounded-2xl bg-status-success/10 p-4">
      <div className="flex items-center justify-end">
        <RowActionsMenu
          label={source.name}
          onEdit={onEdit ? () => onEdit(source) : undefined}
          onDelete={onDelete ? () => onDelete(source) : undefined}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-neutral-900">{source.name}</p>
        <p className="text-xs text-neutral-500">
          {FREQUENCY_LABEL[source.frequency]} · Next {formatRelativeDate(source.nextDate, referenceDate)}
        </p>
      </div>
      <span className="font-serif text-sm text-status-success">₱{source.amount.toFixed(2)}</span>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/accounts/IncomeTile.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Delete the old row component**

```bash
git rm components/accounts/IncomeRow.tsx components/accounts/IncomeRow.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add components/accounts/IncomeTile.tsx components/accounts/IncomeTile.test.tsx
git commit -m "feat: replace IncomeRow with IncomeTile for the tile UI revamp"
```

---

### Task 3: Wire `CardDueTile`/`IncomeTile` into `AccountsPage` via `TileGrid`

**Files:**
- Modify: `app/(shell)/accounts/page.tsx`

**Interfaces:**
- Consumes: `CardDueTile` from `@/components/accounts/CardDueTile` (Task 1); `IncomeTile` from `@/components/accounts/IncomeTile` (Task 2); `TileGrid` from `@/components/shared/TileGrid`.
- No prop or testid changes — `app/(shell)/accounts/page.test.tsx` requires no edits.

- [ ] **Step 1: Confirm the existing test still describes the target behavior**

Read `app/(shell)/accounts/page.test.tsx` — it asserts `getAllByTestId('card-due-row')`/`getAllByTestId('income-row')` counts only (lines 66-67). No test edits needed for this task.

- [ ] **Step 2: Update the implementation**

In `app/(shell)/accounts/page.tsx`, replace the imports:

```tsx
import { CardDueTile } from '@/components/accounts/CardDueTile';
import { IncomeTile } from '@/components/accounts/IncomeTile';
import { TileGrid } from '@/components/shared/TileGrid';
```

(replaces `import { CardDueRow } from '@/components/accounts/CardDueRow';` and `import { IncomeRow } from '@/components/accounts/IncomeRow';`)

Replace the Credit Card Dues section's list wrapper:

```tsx
              <TileGrid testId="accounts-card-tile-grid">
                {cards.map((card) => (
                  <CardDueTile
                    key={card.id}
                    card={card}
                    referenceDate={new Date()}
                    onEdit={openEditCard}
                    onDelete={setDeleteCardTarget}
                  />
                ))}
              </TileGrid>
```

(replaces the `<div className="flex flex-col gap-2">...</div>` wrapper around the `cards.map` call, keeping the `EmptyState` branch as-is)

Replace the Income section's list wrapper:

```tsx
              <TileGrid testId="accounts-income-tile-grid">
                {incomeSources.map((source) => (
                  <IncomeTile
                    key={source.id}
                    source={source}
                    referenceDate={new Date()}
                    onEdit={openEditIncome}
                    onDelete={setDeleteIncomeTarget}
                  />
                ))}
              </TileGrid>
```

(replaces the `<div className="flex flex-col gap-2">...</div>` wrapper around the `incomeSources.map` call, keeping the `EmptyState` branch as-is)

- [ ] **Step 3: Run the existing test to verify no regression**

Run: `npx vitest run "app/(shell)/accounts/page.test.tsx"`
Expected: PASS (unchanged test count)

- [ ] **Step 4: Commit**

```bash
git add "app/(shell)/accounts/page.tsx"
git commit -m "feat: render accounts cards and income as tile grids on the Accounts page"
```

---

### Task 4: Full suite verification

**Files:** None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All test files pass (no other file references `CardDueRow`/`IncomeRow`).

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

Not executable in this environment — flag to the user: open `/accounts` in a browser and confirm the 2-column tile grid renders correctly at mobile width for both Credit Card Dues and Income, tap targets are comfortable, and Edit/Delete still work.
