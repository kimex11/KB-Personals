# Budget Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Budget tab's "Coming soon" placeholder with a real category-budgeting screen (monthly summary, spend-by-category donut chart, per-category progress) per `docs/superpowers/specs/2026-08-07-budget-screen-design.md`.

**Architecture:** Mock category budget data (`lib/budget-data.ts`) behind a `useBudget()` hook, mirroring the `useCalendarEvents()` pattern from Phase 1 — the intended swap point for a real backend later. A hand-built SVG donut chart (no charting library) using a validated categorical color palette (dataviz skill) as new Tailwind v4 theme tokens.

**Tech Stack:** Next.js, TypeScript, Tailwind v4, lucide-react, Vitest + React Testing Library. No new dependencies.

## Global Constraints

- Frontend only — no backend, no persistence, mock data only.
- No hardcoded values duplicated across files — category → color mapping is defined once (`colorSlot` on `BudgetCategory`) and consumed everywhere via a single lookup table per component that needs it.
- Category colors are the validated palette from the design spec: `--color-budget-1` through `--color-budget-6` (`#2a78d6`, `#eb6834`, `#1baf7a`, `#eda100`, `#e87ba4`, `#008300`), plus `--color-status-critical` (`#d03b3b`) reserved for the overspent state — never reused as a 7th category color.
- Color identity must never be color-alone: every place a category color appears (legend, progress bar) must be paired with a visible name/amount label.
- Overspent (`spent > limit`) categories render in status-critical red with an "Over budget" text label, not their categorical color.
- Progress bar fill width is capped at 100% even when spending far exceeds the limit.
- Reuses existing surface/card conventions (rounded-2xl, `border-neutral-200`, `bg-white`) and the `#FAFAFA` page background — no new page-level chrome.

---

### Task 1: Budget Design Tokens

**Files:**
- Modify: `app/globals.css` (add to the existing `@theme inline { ... }` block)
- Test: `budget-theme.test.ts`

**Interfaces:**
- Produces: Tailwind utility classes for `bg-budget-1`..`bg-budget-6`, `stroke-budget-1`..`stroke-budget-6`, `text-status-critical`, `bg-status-critical` via new `--color-budget-1`..`--color-budget-6` and `--color-status-critical` theme tokens.

- [ ] **Step 1: Write the failing test**

Create `budget-theme.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(__dirname, 'app/globals.css'), 'utf-8');

describe('budget design tokens in app/globals.css', () => {
  it('defines the six validated categorical budget colors', () => {
    expect(css).toMatch(/--color-budget-1:\s*#2a78d6;/);
    expect(css).toMatch(/--color-budget-2:\s*#eb6834;/);
    expect(css).toMatch(/--color-budget-3:\s*#1baf7a;/);
    expect(css).toMatch(/--color-budget-4:\s*#eda100;/);
    expect(css).toMatch(/--color-budget-5:\s*#e87ba4;/);
    expect(css).toMatch(/--color-budget-6:\s*#008300;/);
  });

  it('defines the status-critical color for overspent categories', () => {
    expect(css).toMatch(/--color-status-critical:\s*#d03b3b;/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run budget-theme.test.ts
```

Expected: FAIL — `app/globals.css` doesn't yet declare these tokens.

- [ ] **Step 3: Add the tokens**

In `app/globals.css`, add to the existing `@theme inline { ... }` block (alongside `--color-gold`, `--color-ink`, `--font-serif`):

```css
  --color-budget-1: #2a78d6;
  --color-budget-2: #eb6834;
  --color-budget-3: #1baf7a;
  --color-budget-4: #eda100;
  --color-budget-5: #e87ba4;
  --color-budget-6: #008300;
  --color-status-critical: #d03b3b;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run budget-theme.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/globals.css budget-theme.test.ts
git commit -m "feat: add validated budget categorical palette and status-critical color tokens"
```

---

### Task 2: Budget Types & Mock Data

**Files:**
- Create: `lib/budget-types.ts`
- Create: `lib/budget-data.ts`
- Test: `lib/budget-data.test.ts`

**Interfaces:**
- Produces: `BudgetCategory { id: string; name: string; icon: LucideIcon; colorSlot: 1|2|3|4|5|6; limit: number; spent: number }`, `budgetCategories: BudgetCategory[]` (6 entries).

- [ ] **Step 1: Write the failing test**

Create `lib/budget-data.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { budgetCategories } from './budget-data';

describe('budgetCategories', () => {
  it('has exactly 6 categories with unique ids and unique color slots', () => {
    expect(budgetCategories).toHaveLength(6);
    const ids = budgetCategories.map((c) => c.id);
    expect(new Set(ids).size).toBe(6);
    const slots = budgetCategories.map((c) => c.colorSlot);
    expect(new Set(slots)).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

  it('gives every category a positive limit', () => {
    for (const category of budgetCategories) {
      expect(category.limit).toBeGreaterThan(0);
    }
  });

  it('includes at least one category that is over its limit', () => {
    expect(budgetCategories.some((c) => c.spent > c.limit)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run lib/budget-data.test.ts
```

Expected: FAIL — `lib/budget-data.ts` does not exist yet.

- [ ] **Step 3: Write the types**

Create `lib/budget-types.ts`:

```ts
import type { LucideIcon } from 'lucide-react';

export interface BudgetCategory {
  id: string;
  name: string;
  icon: LucideIcon;
  colorSlot: 1 | 2 | 3 | 4 | 5 | 6;
  limit: number;
  spent: number;
}
```

- [ ] **Step 4: Write the mock data**

Create `lib/budget-data.ts`:

```ts
import { Building2, ShoppingCart, Car, Film, Zap, ShoppingBag } from 'lucide-react';
import type { BudgetCategory } from './budget-types';

export const budgetCategories: BudgetCategory[] = [
  { id: 'housing', name: 'Housing', icon: Building2, colorSlot: 1, limit: 1450, spent: 1450 },
  { id: 'groceries', name: 'Groceries', icon: ShoppingCart, colorSlot: 2, limit: 500, spent: 468 },
  { id: 'transport', name: 'Transport', icon: Car, colorSlot: 3, limit: 200, spent: 145 },
  { id: 'entertainment', name: 'Entertainment', icon: Film, colorSlot: 4, limit: 120, spent: 138 },
  { id: 'utilities', name: 'Utilities', icon: Zap, colorSlot: 5, limit: 220, spent: 190 },
  { id: 'shopping', name: 'Shopping', icon: ShoppingBag, colorSlot: 6, limit: 300, spent: 95 },
];
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run lib/budget-data.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/budget-types.ts lib/budget-data.ts lib/budget-data.test.ts
git commit -m "feat: add budget category types and mock data"
```

---

### Task 3: `useBudget` Hook

**Files:**
- Create: `lib/use-budget.ts`
- Test: `lib/use-budget.test.ts`

**Interfaces:**
- Consumes: `budgetCategories` from `./budget-data`; `BudgetCategory` from `./budget-types`.
- Produces: `useBudget(): { categories: BudgetCategory[]; totals: { budgeted: number; spent: number; remaining: number } }`.

- [ ] **Step 1: Write the failing test**

Create `lib/use-budget.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { Home } from 'lucide-react';

vi.mock('./budget-data', () => ({
  budgetCategories: [
    { id: 'a', name: 'A', icon: Home, colorSlot: 1, limit: 100, spent: 80 },
    { id: 'b', name: 'B', icon: Home, colorSlot: 2, limit: 50, spent: 60 },
  ],
}));

import { useBudget } from './use-budget';

describe('useBudget', () => {
  it('computes budgeted/spent/remaining totals from the category list', () => {
    const { result } = renderHook(() => useBudget());
    expect(result.current.totals).toEqual({ budgeted: 150, spent: 140, remaining: 10 });
  });

  it('returns the category list', () => {
    const { result } = renderHook(() => useBudget());
    expect(result.current.categories).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run lib/use-budget.test.ts
```

Expected: FAIL — `lib/use-budget.ts` does not exist yet.

- [ ] **Step 3: Write the hook**

Create `lib/use-budget.ts`:

```ts
'use client';

import { useMemo } from 'react';
import { budgetCategories } from './budget-data';
import type { BudgetCategory } from './budget-types';

export interface BudgetTotals {
  budgeted: number;
  spent: number;
  remaining: number;
}

export function useBudget(): { categories: BudgetCategory[]; totals: BudgetTotals } {
  const categories = budgetCategories;

  const totals = useMemo<BudgetTotals>(() => {
    const budgeted = categories.reduce((sum, c) => sum + c.limit, 0);
    const spent = categories.reduce((sum, c) => sum + c.spent, 0);
    return { budgeted, spent, remaining: budgeted - spent };
  }, [categories]);

  return { categories, totals };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run lib/use-budget.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/use-budget.ts lib/use-budget.test.ts
git commit -m "feat: add useBudget hook computing category totals"
```

---

### Task 4: `BudgetSummary` Component

**Files:**
- Create: `components/budget/BudgetSummary.tsx`
- Test: `components/budget/BudgetSummary.test.tsx`

**Interfaces:**
- Produces: `BudgetSummary({ budgeted: number; spent: number; remaining: number }): JSX.Element`, `data-testid="budget-summary"`.

- [ ] **Step 1: Write the failing test**

Create `components/budget/BudgetSummary.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BudgetSummary } from './BudgetSummary';

describe('BudgetSummary', () => {
  it('renders the three totals', () => {
    render(<BudgetSummary budgeted={1000} spent={800} remaining={200} />);
    expect(screen.getByText('$1000')).toBeInTheDocument();
    expect(screen.getByText('$800')).toBeInTheDocument();
    expect(screen.getByText('$200')).toBeInTheDocument();
  });

  it('renders a negative remaining value in status-critical styling', () => {
    render(<BudgetSummary budgeted={1000} spent={1200} remaining={-200} />);
    const remainingValue = screen.getByText('$-200');
    expect(remainingValue.className).toContain('text-status-critical');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run components/budget/BudgetSummary.test.tsx
```

Expected: FAIL — `components/budget/BudgetSummary.tsx` does not exist yet.

- [ ] **Step 3: Write the component**

Create `components/budget/BudgetSummary.tsx`:

```tsx
interface BudgetSummaryProps {
  budgeted: number;
  spent: number;
  remaining: number;
}

export function BudgetSummary({ budgeted, spent, remaining }: BudgetSummaryProps) {
  return (
    <div data-testid="budget-summary" className="grid grid-cols-3 gap-2">
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-neutral-200 bg-white px-2 py-3">
        <span className="text-xs text-neutral-500">Budgeted</span>
        <span className="font-serif text-lg text-neutral-900">${budgeted.toFixed(0)}</span>
      </div>
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-neutral-200 bg-white px-2 py-3">
        <span className="text-xs text-neutral-500">Spent</span>
        <span className="font-serif text-lg text-neutral-900">${spent.toFixed(0)}</span>
      </div>
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-neutral-200 bg-white px-2 py-3">
        <span className="text-xs text-neutral-500">Remaining</span>
        <span
          className={`font-serif text-lg ${remaining < 0 ? 'text-status-critical' : 'text-neutral-900'}`}
        >
          ${remaining.toFixed(0)}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run components/budget/BudgetSummary.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/budget/BudgetSummary.tsx components/budget/BudgetSummary.test.tsx
git commit -m "feat: add BudgetSummary component"
```

---

### Task 5: `BudgetDonutChart` Component

**Files:**
- Create: `components/budget/BudgetDonutChart.tsx`
- Test: `components/budget/BudgetDonutChart.test.tsx`

**Interfaces:**
- Consumes: `BudgetCategory` from `@/lib/budget-types`.
- Produces: `BudgetDonutChart({ categories: BudgetCategory[] }): JSX.Element`, `data-testid="budget-donut-chart"`, one `data-testid="donut-slice"` per category, one `data-testid="legend-row"` per category (name + spent amount, never color alone).

- [ ] **Step 1: Write the failing test**

Create `components/budget/BudgetDonutChart.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Home } from 'lucide-react';
import { BudgetDonutChart } from './BudgetDonutChart';
import type { BudgetCategory } from '@/lib/budget-types';

const categories: BudgetCategory[] = [
  { id: 'a', name: 'Category A', icon: Home, colorSlot: 1, limit: 100, spent: 60 },
  { id: 'b', name: 'Category B', icon: Home, colorSlot: 2, limit: 50, spent: 40 },
];

describe('BudgetDonutChart', () => {
  it('renders one slice and one legend row per category', () => {
    render(<BudgetDonutChart categories={categories} />);
    expect(screen.getAllByTestId('donut-slice')).toHaveLength(2);
    expect(screen.getAllByTestId('legend-row')).toHaveLength(2);
  });

  it('shows each category name and spent amount in the legend', () => {
    render(<BudgetDonutChart categories={categories} />);
    expect(screen.getByText('Category A')).toBeInTheDocument();
    expect(screen.getByText('$60')).toBeInTheDocument();
    expect(screen.getByText('Category B')).toBeInTheDocument();
    expect(screen.getByText('$40')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run components/budget/BudgetDonutChart.test.tsx
```

Expected: FAIL — `components/budget/BudgetDonutChart.tsx` does not exist yet.

- [ ] **Step 3: Write the component**

Create `components/budget/BudgetDonutChart.tsx`:

```tsx
import type { BudgetCategory } from '@/lib/budget-types';

const STROKE_COLOR_CLASS: Record<number, string> = {
  1: 'stroke-budget-1',
  2: 'stroke-budget-2',
  3: 'stroke-budget-3',
  4: 'stroke-budget-4',
  5: 'stroke-budget-5',
  6: 'stroke-budget-6',
};

const DOT_COLOR_CLASS: Record<number, string> = {
  1: 'bg-budget-1',
  2: 'bg-budget-2',
  3: 'bg-budget-3',
  4: 'bg-budget-4',
  5: 'bg-budget-5',
  6: 'bg-budget-6',
};

interface BudgetDonutChartProps {
  categories: BudgetCategory[];
}

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function BudgetDonutChart({ categories }: BudgetDonutChartProps) {
  const totalSpent = categories.reduce((sum, c) => sum + c.spent, 0);

  let cumulative = 0;
  const slices = categories.map((category) => {
    const fraction = totalSpent > 0 ? category.spent / totalSpent : 0;
    const dash = fraction * CIRCUMFERENCE;
    const dashoffset = -cumulative;
    cumulative += dash;
    return { category, dasharray: `${dash} ${CIRCUMFERENCE - dash}`, dashoffset };
  });

  return (
    <div data-testid="budget-donut-chart">
      <svg viewBox="0 0 100 100" className="mx-auto h-40 w-40 -rotate-90">
        {slices.map(({ category, dasharray, dashoffset }) => (
          <circle
            key={category.id}
            data-testid="donut-slice"
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            strokeWidth="16"
            strokeDasharray={dasharray}
            strokeDashoffset={dashoffset}
            className={STROKE_COLOR_CLASS[category.colorSlot]}
          />
        ))}
      </svg>
      <ul className="mt-4 flex flex-col gap-2">
        {categories.map((category) => (
          <li
            key={category.id}
            data-testid="legend-row"
            className="flex items-center justify-between text-sm"
          >
            <span className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${DOT_COLOR_CLASS[category.colorSlot]}`}
                aria-hidden="true"
              />
              <span className="text-neutral-900">{category.name}</span>
            </span>
            <span className="text-neutral-500">${category.spent.toFixed(0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run components/budget/BudgetDonutChart.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/budget/BudgetDonutChart.tsx components/budget/BudgetDonutChart.test.tsx
git commit -m "feat: add BudgetDonutChart component"
```

---

### Task 6: `BudgetCategoryCard` Component

**Files:**
- Create: `components/budget/BudgetCategoryCard.tsx`
- Test: `components/budget/BudgetCategoryCard.test.tsx`

**Interfaces:**
- Consumes: `BudgetCategory` from `@/lib/budget-types`.
- Produces: `BudgetCategoryCard({ category: BudgetCategory }): JSX.Element`, `data-testid="budget-category-card"`, `data-testid="progress-bar-fill"`, `data-testid="over-budget-label"` (conditional, only when `spent > limit`).

- [ ] **Step 1: Write the failing test**

Create `components/budget/BudgetCategoryCard.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Home } from 'lucide-react';
import { BudgetCategoryCard } from './BudgetCategoryCard';
import type { BudgetCategory } from '@/lib/budget-types';

const underBudget: BudgetCategory = {
  id: 'a',
  name: 'Groceries',
  icon: Home,
  colorSlot: 2,
  limit: 500,
  spent: 400,
};

const overBudget: BudgetCategory = {
  id: 'b',
  name: 'Entertainment',
  icon: Home,
  colorSlot: 4,
  limit: 120,
  spent: 138,
};

describe('BudgetCategoryCard', () => {
  it('shows progress bar width proportional to spent/limit when under budget', () => {
    render(<BudgetCategoryCard category={underBudget} />);
    expect(screen.getByTestId('progress-bar-fill')).toHaveStyle({ width: '80%' });
    expect(screen.queryByTestId('over-budget-label')).not.toBeInTheDocument();
  });

  it('shows the over-budget label and status-critical fill when spent exceeds limit', () => {
    render(<BudgetCategoryCard category={overBudget} />);
    expect(screen.getByTestId('over-budget-label')).toHaveTextContent('Over budget');
    expect(screen.getByTestId('progress-bar-fill').className).toContain('bg-status-critical');
  });

  it('caps the progress bar width at 100% even when far over budget', () => {
    const wayOver: BudgetCategory = { id: 'c', name: 'X', icon: Home, colorSlot: 1, limit: 100, spent: 500 };
    render(<BudgetCategoryCard category={wayOver} />);
    expect(screen.getByTestId('progress-bar-fill')).toHaveStyle({ width: '100%' });
  });

  it('displays the spent-of-limit amounts', () => {
    render(<BudgetCategoryCard category={underBudget} />);
    expect(screen.getByText('$400 of $500')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run components/budget/BudgetCategoryCard.test.tsx
```

Expected: FAIL — `components/budget/BudgetCategoryCard.tsx` does not exist yet.

- [ ] **Step 3: Write the component**

Create `components/budget/BudgetCategoryCard.tsx`:

```tsx
import type { BudgetCategory } from '@/lib/budget-types';

const BAR_COLOR_CLASS: Record<number, string> = {
  1: 'bg-budget-1',
  2: 'bg-budget-2',
  3: 'bg-budget-3',
  4: 'bg-budget-4',
  5: 'bg-budget-5',
  6: 'bg-budget-6',
};

export function BudgetCategoryCard({ category }: { category: BudgetCategory }) {
  const { icon: Icon, name, limit, spent, colorSlot } = category;
  const isOverBudget = spent > limit;
  const progress = Math.min(spent / limit, 1) * 100;

  return (
    <div
      data-testid="budget-category-card"
      className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-4"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-neutral-500" />
          <span className="text-sm font-medium text-neutral-900">{name}</span>
        </span>
        {isOverBudget && (
          <span data-testid="over-budget-label" className="text-xs font-medium text-status-critical">
            Over budget
          </span>
        )}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          data-testid="progress-bar-fill"
          className={`h-full rounded-full ${isOverBudget ? 'bg-status-critical' : BAR_COLOR_CLASS[colorSlot]}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs text-neutral-500">
        ${spent.toFixed(0)} of ${limit.toFixed(0)}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run components/budget/BudgetCategoryCard.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/budget/BudgetCategoryCard.tsx components/budget/BudgetCategoryCard.test.tsx
git commit -m "feat: add BudgetCategoryCard component"
```

---

### Task 7: Budget Page Composition

**Files:**
- Modify: `app/(shell)/budget/page.tsx`
- Modify: `app/(shell)/budget/page.test.tsx`

**Interfaces:**
- Consumes: `useBudget` from `@/lib/use-budget`; `BudgetSummary` from `@/components/budget/BudgetSummary`; `BudgetDonutChart` from `@/components/budget/BudgetDonutChart`; `BudgetCategoryCard` from `@/components/budget/BudgetCategoryCard`.
- Produces: the `/budget` route, rendered with `data-testid="budget-page"`. Replaces the previous `PlaceholderScreen`-based page.

- [ ] **Step 1: Write the failing test**

Replace `app/(shell)/budget/page.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import BudgetPage from './page';

describe('BudgetPage', () => {
  it('composes the summary, donut chart, and one category card per category', () => {
    render(<BudgetPage />);
    expect(screen.getByTestId('budget-page')).toBeInTheDocument();
    expect(screen.getByTestId('budget-summary')).toBeInTheDocument();
    expect(screen.getByTestId('budget-donut-chart')).toBeInTheDocument();
    expect(screen.getAllByTestId('budget-category-card')).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run "app/(shell)/budget/page.test.tsx"
```

Expected: FAIL — the current `app/(shell)/budget/page.tsx` still renders `PlaceholderScreen`, not these test ids.

- [ ] **Step 3: Write the page**

Replace `app/(shell)/budget/page.tsx`:

```tsx
'use client';

import { useBudget } from '@/lib/use-budget';
import { BudgetSummary } from '@/components/budget/BudgetSummary';
import { BudgetDonutChart } from '@/components/budget/BudgetDonutChart';
import { BudgetCategoryCard } from '@/components/budget/BudgetCategoryCard';

export default function BudgetPage() {
  const { categories, totals } = useBudget();

  return (
    <div data-testid="budget-page" className="flex flex-col gap-6 px-4 pb-24 pt-4">
      <BudgetSummary budgeted={totals.budgeted} spent={totals.spent} remaining={totals.remaining} />
      <BudgetDonutChart categories={categories} />
      <div className="flex flex-col gap-3">
        {categories.map((category) => (
          <BudgetCategoryCard key={category.id} category={category} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run "app/(shell)/budget/page.test.tsx"
```

Expected: PASS

- [ ] **Step 5: Run the full suite, then manually verify in the browser**

```bash
npm test
npm run dev
```

Open `http://localhost:3000/budget` and confirm: three summary tiles with correct totals, a donut chart with a legible legend (name + amount per row, not color alone), six category cards each with a correctly proportioned progress bar, and the Entertainment card showing the status-red "Over budget" state distinctly from the six categorical colors used elsewhere. Confirm at mobile viewport width. Then navigate to Home (`/`) and confirm nothing there changed.

- [ ] **Step 6: Commit**

```bash
git add "app/(shell)/budget/page.tsx" "app/(shell)/budget/page.test.tsx"
git commit -m "feat: compose Budget screen from summary, donut chart, and category cards"
```

---

## Spec Coverage Check

- Monthly summary (budgeted/spent/remaining) → Task 4, composed in Task 7
- Spend-by-category donut chart with legend (relief rule satisfied) → Task 5
- Per-category progress bars, overspent status-red state → Task 6
- Validated categorical palette + reserved status-critical color → Task 1
- Mock data with one deliberately overspent category → Task 2
- Swap-point hook pattern (`useBudget`) → Task 3
- Full composition replacing the placeholder → Task 7
