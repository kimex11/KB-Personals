# Tile UI Revamp — Phase 4 (Budget, Manage Categories, Receipts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the tile UI revamp's last phase — restyle `BudgetCategoryCard` and the Manage Categories row into chunkier single-column tiles (per the approved design, these stay single-column, not grid-ed), and bring `ReceiptGrid` in line with the shared `TileGrid` primitive used everywhere else in the revamp.

**Architecture:** `BudgetCategoryCard` and `CategoryList`'s row both currently render as a thin-bordered white card with a small colored icon circle. Both get a new shared color helper, `CARD_TINT_COLOR_CLASS` (added to `lib/category-colors.ts` alongside the existing `ICON_BG_COLOR_CLASS`/`DOT_COLOR_CLASS`), which tints the whole card at `/8` opacity using the category's own `colorSlot` — the same "soft tinted background, no border" language Phases 1-3 already established for status-based tiles, applied here to category-based tiles instead. Padding and icon size increase slightly ("chunkier") to read as a tile rather than a list row. `ReceiptGrid` already renders a 2-column grid of rounded-2xl cards that visually matches the tile language; this phase swaps its hand-rolled `grid grid-cols-2 gap-3` wrapper for the shared `TileGrid` component so there's one source of truth for that layout, matching Phases 2-3.

**Tech Stack:** React 19, TypeScript, Tailwind v4, vitest + @testing-library/react + @testing-library/user-event, @dnd-kit (unchanged — Manage Categories keeps its existing vertical-list drag-to-reorder, not a 2D grid).

## Global Constraints

- Presentation-only change — no repository, hook, or Supabase migration touches anything in this phase.
- Budget category cards and Manage Categories rows stay **single-column** (not wrapped in `TileGrid`) per the design spec — only their internal styling changes.
- Keep `data-testid="budget-category-card"` / `data-testid="category-row"` / `data-testid="receipt-grid"` / `data-testid="receipt-card"` unchanged.
- Manage Categories' drag-to-reorder behavior (`@dnd-kit`, vertical list, keyboard support) is untouched — this phase is styling only.

---

### Task 1: `BudgetCategoryCard` chunkier tile

**Files:**
- Modify: `lib/category-colors.ts`
- Modify: `lib/category-colors.test.ts`
- Modify: `components/budget/BudgetCategoryCard.tsx`
- Modify: `components/budget/BudgetCategoryCard.test.tsx`

**Interfaces:**
- Produces: `CARD_TINT_COLOR_CLASS: Record<number, string>` in `lib/category-colors.ts` — new export, `bg-budget-{slot}/8` per slot 1-12. Consumed by both this task and Task 2.

- [ ] **Step 1: Write the failing test for the new color helper**

In `lib/category-colors.test.ts`, add `CARD_TINT_COLOR_CLASS` to the import and extend the "has a class for every slot" test:

```ts
import {
  STROKE_COLOR_CLASS,
  DOT_COLOR_CLASS,
  BAR_COLOR_CLASS,
  ICON_BG_COLOR_CLASS,
  ICON_TEXT_COLOR_CLASS,
  CARD_TINT_COLOR_CLASS,
  CATEGORY_COLOR_SLOTS,
} from './category-colors';
```

```ts
  it('has a class for every slot in each map', () => {
    CATEGORY_COLOR_SLOTS.forEach((slot) => {
      expect(STROKE_COLOR_CLASS[slot]).toMatch(/^stroke-budget-\d+$/);
      expect(DOT_COLOR_CLASS[slot]).toMatch(/^bg-budget-\d+$/);
      expect(BAR_COLOR_CLASS[slot]).toMatch(/^bg-budget-\d+$/);
      expect(ICON_BG_COLOR_CLASS[slot]).toMatch(/^bg-budget-\d+\/15$/);
      expect(ICON_TEXT_COLOR_CLASS[slot]).toMatch(/^text-budget-\d+$/);
      expect(CARD_TINT_COLOR_CLASS[slot]).toMatch(/^bg-budget-\d+\/8$/);
    });
  });
```

(replaces the existing "has a class for every slot in each map" test body — same test, one more assertion line)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/category-colors.test.ts`
Expected: FAIL — `CARD_TINT_COLOR_CLASS[slot]` is `undefined`

- [ ] **Step 3: Add the color helper**

In `lib/category-colors.ts`, add after `ICON_TEXT_COLOR_CLASS`:

```ts
export const CARD_TINT_COLOR_CLASS: Record<number, string> = {
  1: 'bg-budget-1/8',
  2: 'bg-budget-2/8',
  3: 'bg-budget-3/8',
  4: 'bg-budget-4/8',
  5: 'bg-budget-5/8',
  6: 'bg-budget-6/8',
  7: 'bg-budget-7/8',
  8: 'bg-budget-8/8',
  9: 'bg-budget-9/8',
  10: 'bg-budget-10/8',
  11: 'bg-budget-11/8',
  12: 'bg-budget-12/8',
};
```

Note: keep each entry a literal string (not template-built) — same reason as the existing maps: Tailwind's content scanner needs literal class names to find every candidate at build time.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/category-colors.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the failing test for the tile styling**

In `components/budget/BudgetCategoryCard.test.tsx`, add:

```tsx
  it('tints the card background to match its color slot', () => {
    render(<BudgetCategoryCard category={underBudget} />);
    expect(screen.getByTestId('budget-category-card')).toHaveClass('bg-budget-2/8');
  });
```

(add this as a new test in the `describe('BudgetCategoryCard', ...)` block, alongside the existing five)

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run components/budget/BudgetCategoryCard.test.tsx`
Expected: FAIL — `budget-category-card` does not have class `bg-budget-2/8` (it currently has `bg-white`)

- [ ] **Step 7: Update the implementation**

In `components/budget/BudgetCategoryCard.tsx`:

```tsx
import type { BudgetCategory } from '@/lib/budget-types';
import { BAR_COLOR_CLASS, CARD_TINT_COLOR_CLASS, ICON_BG_COLOR_CLASS, ICON_TEXT_COLOR_CLASS } from '@/lib/category-colors';

export function BudgetCategoryCard({ category }: { category: BudgetCategory }) {
  const { icon: Icon, name, limit, spent, colorSlot } = category;
  const isOverBudget = spent > limit;
  const progress = limit > 0 ? Math.min(spent / limit, 1) * 100 : 0;

  return (
    <div
      data-testid="budget-category-card"
      className={`flex flex-col gap-3 rounded-2xl p-5 ${CARD_TINT_COLOR_CLASS[colorSlot]}`}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${ICON_BG_COLOR_CLASS[colorSlot]}`}>
            <Icon className={`h-5 w-5 ${ICON_TEXT_COLOR_CLASS[colorSlot]}`} />
          </span>
          <span className="text-sm font-medium text-neutral-900">{name}</span>
        </span>
        {isOverBudget && (
          <span data-testid="over-budget-label" className="text-xs font-medium text-status-critical">
            Over budget
          </span>
        )}
      </div>
      <div
        role="progressbar"
        aria-label={`${name} spending`}
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-100"
      >
        <div
          data-testid="progress-bar-fill"
          className={`h-full rounded-full ${isOverBudget ? 'bg-status-critical' : BAR_COLOR_CLASS[colorSlot]}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs text-neutral-500">
        ₱{spent.toFixed(0)} of ₱{limit.toFixed(0)}
      </span>
    </div>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run components/budget/BudgetCategoryCard.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 9: Commit**

```bash
git add lib/category-colors.ts lib/category-colors.test.ts components/budget/BudgetCategoryCard.tsx components/budget/BudgetCategoryCard.test.tsx
git commit -m "feat: restyle BudgetCategoryCard as a chunkier tinted tile"
```

---

### Task 2: Manage Categories row chunkier tile

**Files:**
- Modify: `components/categories/CategoryList.tsx`
- Modify: `components/categories/CategoryList.test.tsx`

**Interfaces:**
- Consumes: `CARD_TINT_COLOR_CLASS` from `@/lib/category-colors` (Task 1).

- [ ] **Step 1: Write the failing test**

In `components/categories/CategoryList.test.tsx`, add:

```tsx
  it('tints each row to match its color slot, and archived rows a neutral gray', () => {
    render(<CategoryList categories={[categories[0], archivedCategory]} onReorder={noop} onEdit={noop} onArchive={noop} onUnarchive={noop} onDelete={noop} />);
    const rows = screen.getAllByTestId('category-row');
    expect(rows[0]).toHaveClass('bg-budget-1/8');
    expect(rows[1]).toHaveClass('bg-neutral-100');
  });
```

(add this as a new test in the `describe('CategoryList', ...)` block, alongside the existing eight)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/categories/CategoryList.test.tsx`
Expected: FAIL — rows currently have class `bg-white`, not `bg-budget-1/8`/`bg-neutral-100`

- [ ] **Step 3: Update the implementation**

In `components/categories/CategoryList.tsx`, add the import:

```tsx
import { DOT_COLOR_CLASS, CARD_TINT_COLOR_CLASS } from '@/lib/category-colors';
```

(replaces `import { DOT_COLOR_CLASS } from '@/lib/category-colors';`)

Update `CategoryRow`'s root element and icon circle:

```tsx
    <li
      ref={setNodeRef}
      style={style}
      data-testid="category-row"
      className={`flex items-center gap-3 rounded-2xl p-4 ${category.archived ? 'bg-neutral-100' : CARD_TINT_COLOR_CLASS[category.colorSlot]}`}
    >
      {!category.archived && (
        <button
          type="button"
          data-testid="category-drag-handle"
          aria-label={`Reorder ${category.name}`}
          className="cursor-grab touch-none text-neutral-400"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${DOT_COLOR_CLASS[category.colorSlot]}`}>
        <Icon className="h-5 w-5 text-white" />
      </span>
```

(replaces the old `className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3"` on the `<li>` and the `h-8 w-8`/`h-4 w-4` icon circle sizing — the rest of `CategoryRow`, from `<span className="flex-1 ...">` down through the `DropdownMenu`, is unchanged)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/categories/CategoryList.test.tsx`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add components/categories/CategoryList.tsx components/categories/CategoryList.test.tsx
git commit -m "feat: restyle the Manage Categories row as a chunkier tinted tile"
```

---

### Task 3: `ReceiptGrid` adopts the shared `TileGrid`

**Files:**
- Modify: `components/receipts/ReceiptGrid.tsx`

**Interfaces:**
- Consumes: `TileGrid` from `@/components/shared/TileGrid` (already exists from Phase 1).
- No prop or testid changes — `ReceiptGrid.test.tsx` requires no edits.

- [ ] **Step 1: Confirm the existing test still describes the target behavior**

Read `components/receipts/ReceiptGrid.test.tsx` — it asserts `getAllByTestId('receipt-card')` counts and per-card behavior passthrough, none of which reference the grid wrapper's markup. No test edits needed for this task.

- [ ] **Step 2: Update the implementation**

In `components/receipts/ReceiptGrid.tsx`, replace the import and the wrapper:

```tsx
import { TileGrid } from '@/components/shared/TileGrid';
```

(add alongside the existing imports)

```tsx
  return (
    <TileGrid testId="receipt-grid">
      {receipts.map((receipt) => (
        <ReceiptCard
          key={receipt.id}
          receipt={receipt}
          onRemove={onRemove}
          onView={onView}
          onRename={onRename}
          onUpdateDescription={onUpdateDescription}
          ocrStatus={ocrStatusById?.[receipt.id]}
          extractedFields={ocrResultById?.[receipt.id]}
          bills={bills}
          onLinkBill={onLinkBill}
        />
      ))}
    </TileGrid>
  );
```

(replaces the `<div data-testid="receipt-grid" className="grid grid-cols-2 gap-3">...</div>` return)

- [ ] **Step 3: Run the existing test to verify no regression**

Run: `npx vitest run components/receipts/ReceiptGrid.test.tsx`
Expected: PASS (6 tests, unchanged)

- [ ] **Step 4: Commit**

```bash
git add components/receipts/ReceiptGrid.tsx
git commit -m "refactor: use the shared TileGrid primitive in ReceiptGrid"
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

Not executable in this environment — flag to the user: open `/budget`, `/budget/categories`, and `/receipts` in a browser and confirm the chunkier single-column tiles read clearly at mobile width, drag-to-reorder still works on Manage Categories, and the receipts grid still looks and behaves the same. This closes out all 4 phases of the tile UI revamp — worth a full pass over `/`, `/bills`, `/reminders`, `/accounts`, `/budget`, `/budget/categories`, and `/receipts` together at that point.
