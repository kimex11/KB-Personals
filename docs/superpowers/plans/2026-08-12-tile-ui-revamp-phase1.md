# Tile UI Revamp — Phase 1 (Shared Primitives + Dashboard Launcher) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the shared `Tile`/`TileGrid` primitives every later phase builds on, and replace the Dashboard's `QuickActionsRow` with a `LauncherTiles` grid (Bills/Reminders/Budget/Accounts/Receipts, each showing a live glance stat).

**Architecture:** `Tile` is a polymorphic tappable shell (renders as a Next `Link` when given `href`, a `<button>` when given `onClick`) with a caller-supplied tint class. `TileGrid` is a 2-column grid wrapper. `LauncherTiles` composes both into the Dashboard's new top section, fed by data `HomePage` already has (bills, reminders, budget totals) plus one newly-wired existing hook (`useAccounts`) for the Accounts tile's card count.

**Tech Stack:** Next.js 16 (App Router), Tailwind v4 (existing design tokens — no new colors), vitest + Testing Library.

## Global Constraints

- No new colors: every tile tint reuses an existing token from `app/globals.css` —
  `status-critical` (red), `calendar-reminder` (blue), `gold` (amber/brand), `status-success`
  (green), `calendar-task` (purple) — all already defined.
- No repository, hook, or Supabase changes anywhere in this plan — this is
  presentation-only, per the design spec (`docs/superpowers/specs/2026-08-12-tile-ui-revamp-design.md`).
  `useAccounts` already exists (`lib/use-accounts.ts`); this plan only adds a new call site
  for it in `HomePage`, it does not modify the hook.
- Every tile is one full-card tap target (Enter/Space work same as click for the
  button variant; a real `<Link>` for the href variant), comfortably past the 44px
  touch-target minimum already enforced elsewhere in this app.
- `QuickActionsRow` is deleted once `LauncherTiles` replaces it — verified as its only
  consumer (`app/(shell)/page.tsx`) before deletion, per this session's "don't remove
  code without verifying impact" convention.

---

### Task 1: `Tile` shared primitive

**Files:**
- Create: `components/shared/Tile.tsx`
- Test: `components/shared/Tile.test.tsx`

**Interfaces:**
- Produces: `Tile` component with props `{ tintClassName: string; href?: string;
  onClick?: () => void; ariaLabel?: string; className?: string; testId?: string;
  children: ReactNode }`. Renders a Next `Link` when `href` is given, a `<button
  type="button">` when `onClick` is given (mutually exclusive per call site — every
  consumer in this plan passes exactly one). Consumed by Task 2 is not applicable (no
  dependency); consumed by Task 3 (`LauncherTiles`) and every later phase's tile
  components.

- [ ] **Step 1: Write the failing test**

```typescript
// components/shared/Tile.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tile } from './Tile';

describe('Tile', () => {
  it('renders as a link when href is given', () => {
    render(
      <Tile href="/bills" tintClassName="bg-status-critical/10">
        Bills
      </Tile>
    );
    const tile = screen.getByTestId('tile');
    expect(tile.tagName).toBe('A');
    expect(tile).toHaveAttribute('href', '/bills');
  });

  it('renders as a button and calls onClick when onClick is given', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Tile onClick={onClick} tintClassName="bg-status-critical/10">
        Edit
      </Tile>
    );
    const tile = screen.getByTestId('tile');
    expect(tile.tagName).toBe('BUTTON');
    await user.click(tile);
    expect(onClick).toHaveBeenCalled();
  });

  it('applies the given tint class', () => {
    render(
      <Tile onClick={vi.fn()} tintClassName="bg-status-success/10">
        Paid
      </Tile>
    );
    expect(screen.getByTestId('tile')).toHaveClass('bg-status-success/10');
  });

  it('uses a custom testId when provided', () => {
    render(
      <Tile onClick={vi.fn()} tintClassName="bg-gold/10" testId="launcher-tile-budget">
        Budget
      </Tile>
    );
    expect(screen.getByTestId('launcher-tile-budget')).toBeInTheDocument();
  });

  it('applies an aria-label when provided', () => {
    render(
      <Tile href="/bills" tintClassName="bg-status-critical/10" ariaLabel="Bills, 1 overdue">
        Bills
      </Tile>
    );
    expect(screen.getByLabelText('Bills, 1 overdue')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/shared/Tile.test.tsx`
Expected: FAIL with "Cannot find module './Tile'"

- [ ] **Step 3: Write the implementation**

```tsx
// components/shared/Tile.tsx
import Link from 'next/link';
import type { ReactNode } from 'react';

interface TileProps {
  tintClassName: string;
  href?: string;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
  testId?: string;
  children: ReactNode;
}

export function Tile({ tintClassName, href, onClick, ariaLabel, className = '', testId = 'tile', children }: TileProps) {
  const sharedClassName = `rounded-2xl p-4 text-left transition-colors ${tintClassName} ${className}`;

  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} data-testid={testId} className={`block ${sharedClassName}`}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} data-testid={testId} className={`w-full ${sharedClassName}`}>
      {children}
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/shared/Tile.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add components/shared/Tile.tsx components/shared/Tile.test.tsx
git commit -m "feat: add shared Tile primitive for the tile UI revamp"
```

---

### Task 2: `TileGrid` shared primitive

**Files:**
- Create: `components/shared/TileGrid.tsx`
- Test: `components/shared/TileGrid.test.tsx`

**Interfaces:**
- Produces: `TileGrid` component with props `{ children: ReactNode; testId?: string }`,
  rendering a `grid grid-cols-2 gap-3` wrapper. Consumed by Task 3 (`LauncherTiles`) and
  every later phase's list screens (Bills/Reminders/Accounts).

- [ ] **Step 1: Write the failing test**

```typescript
// components/shared/TileGrid.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TileGrid } from './TileGrid';

describe('TileGrid', () => {
  it('renders children in a 2-column grid', () => {
    render(
      <TileGrid>
        <div>A</div>
        <div>B</div>
      </TileGrid>
    );
    const grid = screen.getByTestId('tile-grid');
    expect(grid).toHaveClass('grid-cols-2');
    expect(grid).toHaveTextContent('A');
    expect(grid).toHaveTextContent('B');
  });

  it('uses a custom testId when provided', () => {
    render(
      <TileGrid testId="launcher-tiles">
        <div>A</div>
      </TileGrid>
    );
    expect(screen.getByTestId('launcher-tiles')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/shared/TileGrid.test.tsx`
Expected: FAIL with "Cannot find module './TileGrid'"

- [ ] **Step 3: Write the implementation**

```tsx
// components/shared/TileGrid.tsx
import type { ReactNode } from 'react';

interface TileGridProps {
  children: ReactNode;
  testId?: string;
}

export function TileGrid({ children, testId = 'tile-grid' }: TileGridProps) {
  return (
    <div data-testid={testId} className="grid grid-cols-2 gap-3">
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/shared/TileGrid.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add components/shared/TileGrid.tsx components/shared/TileGrid.test.tsx
git commit -m "feat: add shared TileGrid primitive for the tile UI revamp"
```

---

### Task 3: `LauncherTiles` Dashboard component

**Files:**
- Create: `components/dashboard/LauncherTiles.tsx`
- Test: `components/dashboard/LauncherTiles.test.tsx`

**Interfaces:**
- Consumes: `Tile` from `components/shared/Tile.tsx` (Task 1); `TileGrid` from
  `components/shared/TileGrid.tsx` (Task 2).
- Produces: `LauncherTileData` interface (`{ id: 'bills' | 'reminders' | 'budget' |
  'accounts' | 'receipts'; label: string; stat: string; href: string }`),
  `LauncherTiles` component with props `{ tiles: LauncherTileData[] }`. Consumed by
  Task 4 (`HomePage`).

- [ ] **Step 1: Write the failing test**

```typescript
// components/dashboard/LauncherTiles.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LauncherTiles } from './LauncherTiles';
import type { LauncherTileData } from './LauncherTiles';

const tiles: LauncherTileData[] = [
  { id: 'bills', label: 'Bills', stat: '1 overdue', href: '/bills' },
  { id: 'reminders', label: 'Reminders', stat: '3 upcoming', href: '/reminders' },
  { id: 'budget', label: 'Budget', stat: '₱1918 of ₱1950', href: '/budget' },
  { id: 'accounts', label: 'Accounts', stat: '2 cards linked', href: '/accounts' },
  { id: 'receipts', label: 'Receipts', stat: 'Scan a new receipt', href: '/receipts' },
];

describe('LauncherTiles', () => {
  it('renders one tile per entry with its label, stat, and link', () => {
    render(<LauncherTiles tiles={tiles} />);
    for (const tile of tiles) {
      const el = screen.getByTestId(`launcher-tile-${tile.id}`);
      expect(el).toHaveTextContent(tile.label);
      expect(el).toHaveTextContent(tile.stat);
      expect(el).toHaveAttribute('href', tile.href);
    }
  });

  it('renders inside the shared tile grid', () => {
    render(<LauncherTiles tiles={tiles} />);
    expect(screen.getByTestId('launcher-tiles')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/dashboard/LauncherTiles.test.tsx`
Expected: FAIL with "Cannot find module './LauncherTiles'"

- [ ] **Step 3: Write the implementation**

```tsx
// components/dashboard/LauncherTiles.tsx
import type { LucideIcon } from 'lucide-react';
import { Receipt, Bell, Wallet, CreditCard, Camera } from 'lucide-react';
import { Tile } from '@/components/shared/Tile';
import { TileGrid } from '@/components/shared/TileGrid';

export interface LauncherTileData {
  id: 'bills' | 'reminders' | 'budget' | 'accounts' | 'receipts';
  label: string;
  stat: string;
  href: string;
}

const TILE_CONFIG: Record<LauncherTileData['id'], { icon: LucideIcon; tintClassName: string; iconClassName: string }> = {
  bills: { icon: Receipt, tintClassName: 'bg-status-critical/10', iconClassName: 'text-status-critical' },
  reminders: { icon: Bell, tintClassName: 'bg-calendar-reminder/10', iconClassName: 'text-calendar-reminder' },
  budget: { icon: Wallet, tintClassName: 'bg-gold/10', iconClassName: 'text-gold' },
  accounts: { icon: CreditCard, tintClassName: 'bg-status-success/10', iconClassName: 'text-status-success' },
  receipts: { icon: Camera, tintClassName: 'bg-calendar-task/10', iconClassName: 'text-calendar-task' },
};

interface LauncherTilesProps {
  tiles: LauncherTileData[];
}

export function LauncherTiles({ tiles }: LauncherTilesProps) {
  return (
    <TileGrid testId="launcher-tiles">
      {tiles.map((tile) => {
        const config = TILE_CONFIG[tile.id];
        const Icon = config.icon;
        return (
          <Tile
            key={tile.id}
            href={tile.href}
            tintClassName={config.tintClassName}
            ariaLabel={`${tile.label}, ${tile.stat}`}
            testId={`launcher-tile-${tile.id}`}
          >
            <Icon className={`h-6 w-6 ${config.iconClassName}`} />
            <p className="mt-2 text-sm font-medium text-neutral-900">{tile.label}</p>
            <p className="text-xs text-neutral-500">{tile.stat}</p>
          </Tile>
        );
      })}
    </TileGrid>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/dashboard/LauncherTiles.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/LauncherTiles.tsx components/dashboard/LauncherTiles.test.tsx
git commit -m "feat: add LauncherTiles Dashboard component"
```

---

### Task 4: Wire `LauncherTiles` into `HomePage`, delete `QuickActionsRow`

**Files:**
- Modify: `app/(shell)/page.tsx`
- Modify: `app/(shell)/page.test.tsx`
- Delete: `components/dashboard/QuickActionsRow.tsx`
- Delete: `components/dashboard/QuickActionsRow.test.tsx`

**Interfaces:**
- Consumes: `LauncherTiles`, `LauncherTileData` from `components/dashboard/LauncherTiles.tsx`
  (Task 3); `useAccounts` from `lib/use-accounts.ts` (pre-existing, unmodified — returns
  `{ cards, incomeSources, loading, error, ... }`, only `cards` is used here).

- [ ] **Step 1: Write the failing test additions**

Update `app/(shell)/page.test.tsx`: replace the `quick-actions-row` assertion with a
`launcher-tiles` one, and add a mock for `@/lib/use-accounts` (every other test in this
file already mocks its data hooks the same way, so this new mock must be present before
any test renders `HomePage`, not just the one that asserts on it):

```typescript
// Add near the other hook mocks at the top of the file:
vi.mock('@/lib/use-accounts', () => ({
  useAccounts: () => ({
    cards: [{ id: 'card-1', cardName: 'Visa', last4: '1234', statementBalance: 100, minimumPayment: 10, dueDate: '2026-09-01' }],
    incomeSources: [],
    loading: false,
    error: null,
    createCard: vi.fn(),
    updateCard: vi.fn(),
    deleteCard: vi.fn(),
    createIncome: vi.fn(),
    updateIncome: vi.fn(),
    deleteIncome: vi.fn(),
  }),
}));
```

```typescript
// Replace this existing test:
it('renders the weekly bills panel, spending snapshot, reminders, and quick actions', () => {
  render(<HomePage />);
  expect(screen.getByTestId('weekly-bills-panel')).toBeInTheDocument();
  expect(screen.getByTestId('spending-snapshot')).toBeInTheDocument();
  expect(screen.getByTestId('reminders-panel')).toBeInTheDocument();
  expect(screen.getByTestId('quick-actions-row')).toBeInTheDocument();
});

// with:
it('renders the weekly bills panel, spending snapshot, reminders, and launcher tiles', () => {
  render(<HomePage />);
  expect(screen.getByTestId('weekly-bills-panel')).toBeInTheDocument();
  expect(screen.getByTestId('spending-snapshot')).toBeInTheDocument();
  expect(screen.getByTestId('reminders-panel')).toBeInTheDocument();
  expect(screen.getByTestId('launcher-tiles')).toBeInTheDocument();
});

// New test:
it('shows the accounts card count on the Accounts launcher tile', () => {
  render(<HomePage />);
  expect(screen.getByTestId('launcher-tile-accounts')).toHaveTextContent('1 card linked');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/(shell)/page.test.tsx"`
Expected: FAIL — `launcher-tiles`/`launcher-tile-accounts` don't exist yet, `HomePage`
still renders `QuickActionsRow`

- [ ] **Step 3: Update `HomePage`**

```tsx
// app/(shell)/page.tsx — replace the QuickActionsRow import and usage
```

Remove this import:

```typescript
import { QuickActionsRow } from '@/components/dashboard/QuickActionsRow';
```

Add these imports:

```typescript
import { useAccounts } from '@/lib/use-accounts';
import { LauncherTiles, type LauncherTileData } from '@/components/dashboard/LauncherTiles';
```

Add, right after the existing `useReminders()` call:

```typescript
  const { cards } = useAccounts();
```

Add, right after the `alertItems`/`useOverdueAlerts` block (after computing `totals`,
`overdueBills`, `weeklyBills`, `upcomingReminders`, all of which already exist in this
component):

```typescript
  const launcherTiles: LauncherTileData[] = [
    {
      id: 'bills',
      label: 'Bills',
      stat:
        overdueBills.length > 0
          ? `${overdueBills.length} overdue`
          : weeklyBills.length > 0
            ? `${weeklyBills.length} due this week`
            : 'All caught up',
      href: '/bills',
    },
    {
      id: 'reminders',
      label: 'Reminders',
      stat: upcomingReminders.length > 0 ? `${upcomingReminders.length} upcoming` : 'Nothing upcoming',
      href: '/reminders',
    },
    {
      id: 'budget',
      label: 'Budget',
      stat: `₱${totals.spent.toFixed(0)} of ₱${totals.budgeted.toFixed(0)}`,
      href: '/budget',
    },
    {
      id: 'accounts',
      label: 'Accounts',
      stat: cards.length > 0 ? `${cards.length} card${cards.length === 1 ? '' : 's'} linked` : 'No cards yet',
      href: '/accounts',
    },
    {
      id: 'receipts',
      label: 'Receipts',
      stat: 'Scan a new receipt',
      href: '/receipts',
    },
  ];
```

Replace `<QuickActionsRow />` in the JSX with:

```tsx
          <LauncherTiles tiles={launcherTiles} />
```

- [ ] **Step 4: Delete `QuickActionsRow` and its test**

```bash
git rm components/dashboard/QuickActionsRow.tsx components/dashboard/QuickActionsRow.test.tsx
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run "app/(shell)/page.test.tsx"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add "app/(shell)/page.tsx" "app/(shell)/page.test.tsx"
git commit -m "feat: replace QuickActionsRow with the LauncherTiles dashboard grid"
```

---

### Task 5: Full suite verification

**Files:** none created — verification task.

- [ ] **Step 1: Run the full automated suite**

```bash
npx vitest run
npx tsc --noEmit
npx eslint .
npx next build
```

Expected: all green. This phase only added new components and changed `HomePage`'s
top section — no hook, repository, or migration touched, so no other test file should
be affected.

- [ ] **Step 2: Manual smoke check**

Needs a real browser (not available in this environment): open the Dashboard, confirm
the 5 launcher tiles render with correct colors/icons, each navigates to the right page
on tap, and the stats update after marking a bill paid or adding a reminder.
