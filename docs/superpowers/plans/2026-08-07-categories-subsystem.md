# Categories Subsystem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Budget's hardcoded 6-category list with a real, shared Supabase `categories` table, plus a full "Manage Categories" screen (create/edit/archive/delete-with-reassign/merge/drag-reorder), so the Bills migration that follows can reference `category_id` instead of free text.

**Architecture:** Mirrors the receipts feature exactly: a `lib/categories-repository.ts` of plain async functions wrapping a fresh `createClient()` per call, a `use-categories.ts` hook for component state, and dumb presentational components. Categories are global/shared (RLS gated on `authenticated`, no per-row ownership) since this is a single-admin app. Budget's `limit`/`spent` stay mock, now looked up by category **name** instead of the old string id.

**Tech Stack:** Next.js (App Router), Supabase (`@supabase/ssr`), Vitest + React Testing Library, `@dnd-kit/core` + `@dnd-kit/sortable` (new dependency), Tailwind v4 `@theme inline` tokens.

## Global Constraints

- Categories table is **global/shared** — RLS policies gate on `to authenticated`, not `auth.uid()` ownership (spec: "Data model").
- Icon choice is a fixed curated set of 24 keys (spec: "Icon & color") — no free text, no full lucide picker.
- Color choice is a fixed 12-swatch palette (spec: "Icon & color") — no hex picker.
- Reorder is drag-and-drop (spec: "UI"), not up/down buttons.
- Delete blocks and forces reassignment when bills reference the category; archive does not require emptying first (spec: "UI", "Repository").
- Budget's `limit`/`spent` remain mock/local this phase — only category identity (name/icon/color/order/archived) goes real (spec: "Scope for this phase").
- Bills table does not exist yet — any repository call that touches `public.bills` must be guarded so a "relation does not exist" error (Postgres code `42P01`) is swallowed, not thrown (spec: "Repository" note).
- Follow existing repository style: plain exported async functions, fresh `createClient()` per call, manual snake_case↔camelCase row mapping — see `lib/receipts-repository.ts`.

---

## File Structure

New files:
- `supabase/migrations/0004_categories.sql` — table, RLS, seed data
- `lib/categories-types.ts` — `Category`, `CategoryIconKey`
- `lib/category-icons.ts` — `ICON_MAP`
- `lib/category-colors.ts` — `STROKE_COLOR_CLASS`, `DOT_COLOR_CLASS`, `BAR_COLOR_CLASS` (1-12)
- `lib/categories-repository.ts` — CRUD + archive/merge/reorder/count
- `lib/use-categories.ts` — hook
- `lib/categories-reorder.ts` — pure `reorderIds()` helper (extracted so drag logic is unit-testable without simulating real pointer/keyboard drag events)
- `components/categories/CategoryList.tsx` — drag-reorderable list
- `components/categories/CategoryForm.tsx` — add/edit sheet
- `components/categories/DeleteCategoryDialog.tsx` — delete-with-reassign sheet
- `components/categories/MergeCategoriesDialog.tsx` — merge sheet
- `app/(shell)/budget/categories/page.tsx` — the "Manage Categories" screen

Modified files:
- `app/globals.css` — add `--color-budget-7` through `--color-budget-12` tokens
- `components/budget/BudgetCategoryCard.tsx` — import `BAR_COLOR_CLASS` from `lib/category-colors.ts` instead of its local copy
- `components/budget/BudgetDonutChart.tsx` — import `STROKE_COLOR_CLASS`/`DOT_COLOR_CLASS` from `lib/category-colors.ts` instead of local copies
- `lib/budget-data.ts` — re-key mock `limit`/`spent` by category **name** instead of string id
- `lib/use-budget.ts` — source categories from `use-categories()` instead of the static array, join by name with a `{ limit: 0, spent: 0 }` default
- `app/(shell)/budget/page.tsx` — add a gear-icon link to `/budget/categories`
- `package.json` — add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

---

### Task 1: Migration + apply to Supabase + types

**Files:**
- Create: `supabase/migrations/0004_categories.sql`
- Create: `lib/categories-types.ts`
- Test: `lib/categories-types.test.ts`

**Interfaces:**
- Produces: `Category { id: string; name: string; icon: CategoryIconKey; colorSlot: number; sortOrder: number; archived: boolean; createdAt: string }`, `CategoryIconKey` (24-member string union)

- [ ] **Step 1: Write the migration file**

`supabase/migrations/0004_categories.sql`:

```sql
-- Categories: a global, shared classification used by Budget and (soon)
-- Bills. Not per-user like receipts — this is a single-admin app and
-- categories aren't personal data, so RLS just gates on `authenticated`.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text not null,
  color_slot integer not null check (color_slot between 1 and 12),
  sort_order integer not null,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy "Authenticated users can view categories"
  on public.categories for select to authenticated using (true);
create policy "Authenticated users can insert categories"
  on public.categories for insert to authenticated with check (true);
create policy "Authenticated users can update categories"
  on public.categories for update to authenticated using (true);
create policy "Authenticated users can delete categories"
  on public.categories for delete to authenticated using (true);

create index categories_sort_order_idx on public.categories(sort_order);

insert into public.categories (name, icon, color_slot, sort_order) values
  ('Housing', 'building-2', 1, 0),
  ('Groceries', 'shopping-cart', 2, 1),
  ('Transport', 'car', 3, 2),
  ('Entertainment', 'film', 4, 3),
  ('Utilities', 'zap', 5, 4),
  ('Shopping', 'shopping-bag', 6, 5);
```

- [ ] **Step 2: Apply the migration to the live Supabase project**

The project isn't linked via the Supabase CLI (`supabase link` fails with `LegacyProjectNotLinkedError`) and the MCP Supabase connector's `list_projects` doesn't include this project (different org). Apply directly via `pg` using `DATABASE_URL` from `.env.local`, the same method used to verify migration 0003 earlier:

```bash
cd "/Users/kendrickynanflores/Documents/Personal/Claude/Financial Tracker"
set -a && source .env.local && set +a
node -e "
const fs = require('fs');
const { Client } = require('pg');
const sql = fs.readFileSync('supabase/migrations/0004_categories.sql', 'utf8');
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect().then(async () => {
  await c.query(sql);
  console.log('applied');
  await c.end();
}).catch((e) => { console.error('ERR', e.message); process.exit(1); });
"
```

Run this with `dangerouslyDisableSandbox: true` (network access needed) — same as the receipt-linking verification pass. Expected output: `applied`.

- [ ] **Step 3: Verify the table exists with 6 seeded rows**

```bash
node -e "
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect().then(async () => {
  const r = await c.query('select name, icon, color_slot, sort_order, archived from public.categories order by sort_order');
  console.log(r.rows);
  await c.end();
});
"
```

Expected: 6 rows, Housing through Shopping, `sort_order` 0-5, all `archived: false`.

- [ ] **Step 4: Write the failing test for types**

`lib/categories-types.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import type { Category, CategoryIconKey } from './categories-types';

describe('categories-types', () => {
  it('accepts a well-formed Category', () => {
    const category: Category = {
      id: 'cat-1',
      name: 'Housing',
      icon: 'building-2',
      colorSlot: 1,
      sortOrder: 0,
      archived: false,
      createdAt: '2026-08-15T10:00:00.000Z',
    };
    expect(category.name).toBe('Housing');
  });

  it('rejects an icon key outside the curated set', () => {
    // @ts-expect-error - 'rocket' is not a CategoryIconKey
    const icon: CategoryIconKey = 'rocket';
    expect(icon).toBe('rocket');
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npm test -- lib/categories-types.test.ts`
Expected: FAIL — `Cannot find module './categories-types'`

- [ ] **Step 6: Write the types**

`lib/categories-types.ts`:

```typescript
export type CategoryIconKey =
  | 'building-2'
  | 'shopping-cart'
  | 'car'
  | 'film'
  | 'zap'
  | 'shopping-bag'
  | 'home'
  | 'heart'
  | 'plane'
  | 'coffee'
  | 'gift'
  | 'book'
  | 'dumbbell'
  | 'smartphone'
  | 'wifi'
  | 'credit-card'
  | 'piggy-bank'
  | 'wallet'
  | 'utensils'
  | 'bus'
  | 'fuel'
  | 'graduation-cap'
  | 'stethoscope'
  | 'paw-print';

export interface Category {
  id: string;
  name: string;
  icon: CategoryIconKey;
  colorSlot: number; // 1-12
  sortOrder: number;
  archived: boolean;
  createdAt: string;
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- lib/categories-types.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0004_categories.sql lib/categories-types.ts lib/categories-types.test.ts
git commit -m "feat: add categories table migration and types"
```

---

### Task 2: Category icons module

**Files:**
- Create: `lib/category-icons.ts`
- Test: `lib/category-icons.test.ts`

**Interfaces:**
- Consumes: `CategoryIconKey` from Task 1
- Produces: `ICON_MAP: Record<CategoryIconKey, LucideIcon>`, `CATEGORY_ICON_KEYS: CategoryIconKey[]` (ordered array for rendering the picker grid)

- [ ] **Step 1: Write the failing test**

`lib/category-icons.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { ICON_MAP, CATEGORY_ICON_KEYS } from './category-icons';
import type { CategoryIconKey } from './categories-types';

describe('category-icons', () => {
  it('has exactly 24 curated icon keys', () => {
    expect(CATEGORY_ICON_KEYS).toHaveLength(24);
  });

  it('maps every key to a component', () => {
    CATEGORY_ICON_KEYS.forEach((key) => {
      expect(ICON_MAP[key]).toBeDefined();
    });
  });

  it('has no duplicate keys', () => {
    expect(new Set(CATEGORY_ICON_KEYS).size).toBe(CATEGORY_ICON_KEYS.length);
  });

  it('includes the 6 default category icons', () => {
    const defaults: CategoryIconKey[] = ['building-2', 'shopping-cart', 'car', 'film', 'zap', 'shopping-bag'];
    defaults.forEach((key) => expect(CATEGORY_ICON_KEYS).toContain(key));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/category-icons.test.ts`
Expected: FAIL — `Cannot find module './category-icons'`

- [ ] **Step 3: Write the implementation**

`lib/category-icons.ts`:

```typescript
import {
  Building2,
  ShoppingCart,
  Car,
  Film,
  Zap,
  ShoppingBag,
  Home,
  Heart,
  Plane,
  Coffee,
  Gift,
  Book,
  Dumbbell,
  Smartphone,
  Wifi,
  CreditCard,
  PiggyBank,
  Wallet,
  Utensils,
  Bus,
  Fuel,
  GraduationCap,
  Stethoscope,
  PawPrint,
  type LucideIcon,
} from 'lucide-react';
import type { CategoryIconKey } from './categories-types';

export const ICON_MAP: Record<CategoryIconKey, LucideIcon> = {
  'building-2': Building2,
  'shopping-cart': ShoppingCart,
  car: Car,
  film: Film,
  zap: Zap,
  'shopping-bag': ShoppingBag,
  home: Home,
  heart: Heart,
  plane: Plane,
  coffee: Coffee,
  gift: Gift,
  book: Book,
  dumbbell: Dumbbell,
  smartphone: Smartphone,
  wifi: Wifi,
  'credit-card': CreditCard,
  'piggy-bank': PiggyBank,
  wallet: Wallet,
  utensils: Utensils,
  bus: Bus,
  fuel: Fuel,
  'graduation-cap': GraduationCap,
  stethoscope: Stethoscope,
  'paw-print': PawPrint,
};

export const CATEGORY_ICON_KEYS = Object.keys(ICON_MAP) as CategoryIconKey[];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/category-icons.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/category-icons.ts lib/category-icons.test.ts
git commit -m "feat: add curated category icon set"
```

---

### Task 3: Category colors module + globals.css tokens + Budget component wiring

**Files:**
- Create: `lib/category-colors.ts`
- Test: `lib/category-colors.test.ts`
- Modify: `app/globals.css:19` (after the existing `--color-budget-6` line)
- Modify: `components/budget/BudgetCategoryCard.tsx:1-9`
- Modify: `components/budget/BudgetDonutChart.tsx:1-18`

**Interfaces:**
- Produces: `STROKE_COLOR_CLASS: Record<number, string>`, `DOT_COLOR_CLASS: Record<number, string>`, `BAR_COLOR_CLASS: Record<number, string>` (keys 1-12), `CATEGORY_COLOR_SLOTS: number[]` (`[1..12]`, for rendering the swatch picker)

- [ ] **Step 1: Write the failing test**

`lib/category-colors.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { STROKE_COLOR_CLASS, DOT_COLOR_CLASS, BAR_COLOR_CLASS, CATEGORY_COLOR_SLOTS } from './category-colors';

describe('category-colors', () => {
  it('defines 12 color slots', () => {
    expect(CATEGORY_COLOR_SLOTS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('has a class for every slot in each map', () => {
    CATEGORY_COLOR_SLOTS.forEach((slot) => {
      expect(STROKE_COLOR_CLASS[slot]).toMatch(/^stroke-budget-\d+$/);
      expect(DOT_COLOR_CLASS[slot]).toMatch(/^bg-budget-\d+$/);
      expect(BAR_COLOR_CLASS[slot]).toMatch(/^bg-budget-\d+$/);
    });
  });

  it('preserves the existing 1-6 slot values used by Budget today', () => {
    expect(BAR_COLOR_CLASS[1]).toBe('bg-budget-1');
    expect(STROKE_COLOR_CLASS[6]).toBe('stroke-budget-6');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/category-colors.test.ts`
Expected: FAIL — `Cannot find module './category-colors'`

- [ ] **Step 3: Add the new color tokens to globals.css**

Edit `app/globals.css`, after line 19 (`--color-budget-6: #008300;`), add:

```css
  --color-budget-7: #6d4fc2;
  --color-budget-8: #c2417d;
  --color-budget-9: #3fa7a0;
  --color-budget-10: #b0793a;
  --color-budget-11: #4f7fd6;
  --color-budget-12: #7a8a3d;
```

- [ ] **Step 4: Write the implementation**

`lib/category-colors.ts`:

```typescript
export const CATEGORY_COLOR_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function buildColorMap(prefix: string): Record<number, string> {
  return CATEGORY_COLOR_SLOTS.reduce<Record<number, string>>((map, slot) => {
    map[slot] = `${prefix}-budget-${slot}`;
    return map;
  }, {});
}

export const STROKE_COLOR_CLASS: Record<number, string> = buildColorMap('stroke');
export const DOT_COLOR_CLASS: Record<number, string> = buildColorMap('bg');
export const BAR_COLOR_CLASS: Record<number, string> = buildColorMap('bg');
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- lib/category-colors.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Point BudgetCategoryCard at the shared color map**

Edit `components/budget/BudgetCategoryCard.tsx` — replace lines 1-9:

```typescript
import type { BudgetCategory } from '@/lib/budget-types';
import { BAR_COLOR_CLASS } from '@/lib/category-colors';
```

(Delete the local `const BAR_COLOR_CLASS: Record<number, string> = { ... }` block entirely — the import above replaces it. Rest of the file is unchanged.)

- [ ] **Step 7: Point BudgetDonutChart at the shared color map**

Edit `components/budget/BudgetDonutChart.tsx` — replace lines 1-18:

```typescript
import type { BudgetCategory } from '@/lib/budget-types';
import { STROKE_COLOR_CLASS, DOT_COLOR_CLASS } from '@/lib/category-colors';
```

(Delete both local `const STROKE_COLOR_CLASS` and `const DOT_COLOR_CLASS` blocks — the import above replaces them. Rest of the file is unchanged.)

- [ ] **Step 8: Run the existing Budget component tests to confirm no regression**

Run: `npm test -- components/budget/BudgetCategoryCard.test.tsx components/budget/BudgetDonutChart.test.tsx`
Expected: PASS (all existing tests, unchanged — slots 1-6 render identical classes)

- [ ] **Step 9: Commit**

```bash
git add app/globals.css lib/category-colors.ts lib/category-colors.test.ts components/budget/BudgetCategoryCard.tsx components/budget/BudgetDonutChart.tsx
git commit -m "feat: extend budget color palette to 12 slots, share it with Categories"
```

---

### Task 4: Categories repository

**Files:**
- Create: `lib/categories-repository.ts`
- Test: `lib/categories-repository.test.ts`

**Interfaces:**
- Consumes: `createClient` from `lib/supabase/client.ts`, `Category`/`CategoryIconKey` from Task 1
- Produces: `listCategories(): Promise<Category[]>`, `createCategory(input: { name: string; icon: CategoryIconKey; colorSlot: number }): Promise<Category>`, `updateCategory(id: string, patch: Partial<Pick<Category, 'name' | 'icon' | 'colorSlot'>>): Promise<Category>`, `archiveCategory(id: string): Promise<void>`, `unarchiveCategory(id: string): Promise<void>`, `countBillsUsingCategory(id: string): Promise<number>`, `deleteCategory(id: string, reassignToId?: string): Promise<void>`, `mergeCategories(sourceId: string, targetId: string): Promise<void>`, `reorderCategories(orderedIds: string[]): Promise<void>`

- [ ] **Step 1: Write the failing tests**

`lib/categories-repository.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  listCategories,
  createCategory,
  updateCategory,
  archiveCategory,
  unarchiveCategory,
  countBillsUsingCategory,
  deleteCategory,
  mergeCategories,
  reorderCategories,
} from './categories-repository';

const selectOrderMock = vi.fn();
const insertSelectSingleMock = vi.fn();
const insertMock = vi.fn(() => ({ select: () => ({ single: insertSelectSingleMock }) }));
const maxSortOrderMock = vi.fn();
const updateSelectSingleMock = vi.fn();
const updateEqMock = vi.fn(() => ({ select: () => ({ single: updateSelectSingleMock }) }));
const updateMock = vi.fn(() => ({ eq: updateEqMock }));
const plainUpdateEqMock = vi.fn();
const plainUpdateMock = vi.fn(() => ({ eq: plainUpdateEqMock }));
const deleteEqMock = vi.fn();
const deleteMock = vi.fn(() => ({ eq: deleteEqMock }));
const countHeadEqMock = vi.fn();
const billsSelectMock = vi.fn(() => ({ eq: countHeadEqMock }));
const billsUpdateEqMock = vi.fn();
const billsUpdateMock = vi.fn(() => ({ eq: billsUpdateEqMock }));

vi.mock('./supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'bills') {
        return { select: billsSelectMock, update: billsUpdateMock };
      }
      if (table !== 'categories') throw new Error(`Unexpected table: ${table}`);
      return {
        select: () => ({
          order: selectOrderMock,
        }),
        insert: insertMock,
        update: (payload: unknown) => {
          plainUpdateMock(payload);
          updateMock(payload);
          return { eq: (col: string, val: string) => ({ ...updateEqMock(col, val), then: undefined, eq: plainUpdateEqMock(col, val) }) };
        },
        delete: deleteMock,
      };
    },
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('listCategories', () => {
  it('returns categories ordered by sort_order', async () => {
    selectOrderMock.mockResolvedValue({
      data: [
        { id: 'cat-1', name: 'Housing', icon: 'building-2', color_slot: 1, sort_order: 0, archived: false, created_at: '2026-08-15T10:00:00.000Z' },
      ],
      error: null,
    });
    const result = await listCategories();
    expect(result).toEqual([
      { id: 'cat-1', name: 'Housing', icon: 'building-2', colorSlot: 1, sortOrder: 0, archived: false, createdAt: '2026-08-15T10:00:00.000Z' },
    ]);
  });

  it('throws on error', async () => {
    selectOrderMock.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(listCategories()).rejects.toThrow('boom');
  });
});

describe('countBillsUsingCategory', () => {
  it('returns the count when the bills table exists', async () => {
    countHeadEqMock.mockResolvedValue({ count: 3, error: null });
    expect(await countBillsUsingCategory('cat-1')).toBe(3);
    expect(billsSelectMock).toHaveBeenCalledWith('id', { count: 'exact', head: true });
  });

  it('returns 0 when the bills table does not exist yet', async () => {
    countHeadEqMock.mockResolvedValue({ count: null, error: { code: '42P01', message: 'relation "bills" does not exist' } });
    expect(await countBillsUsingCategory('cat-1')).toBe(0);
  });

  it('rethrows other errors', async () => {
    countHeadEqMock.mockResolvedValue({ count: null, error: { code: 'XX000', message: 'boom' } });
    await expect(countBillsUsingCategory('cat-1')).rejects.toThrow('boom');
  });
});

describe('deleteCategory', () => {
  it('deletes without reassigning when no reassignToId is given', async () => {
    deleteEqMock.mockResolvedValue({ error: null });
    await deleteCategory('cat-1');
    expect(billsUpdateMock).not.toHaveBeenCalled();
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'cat-1');
  });

  it('reassigns bills before deleting when reassignToId is given', async () => {
    billsUpdateEqMock.mockResolvedValue({ error: null });
    deleteEqMock.mockResolvedValue({ error: null });
    await deleteCategory('cat-1', 'cat-2');
    expect(billsUpdateMock).toHaveBeenCalledWith({ category_id: 'cat-2' });
    expect(billsUpdateEqMock).toHaveBeenCalledWith('category_id', 'cat-1');
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'cat-1');
  });

  it('swallows a missing-bills-table error during reassignment and still deletes', async () => {
    billsUpdateEqMock.mockResolvedValue({ error: { code: '42P01', message: 'relation "bills" does not exist' } });
    deleteEqMock.mockResolvedValue({ error: null });
    await deleteCategory('cat-1', 'cat-2');
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'cat-1');
  });
});

describe('mergeCategories', () => {
  it('reassigns bills from source to target then deletes source', async () => {
    billsUpdateEqMock.mockResolvedValue({ error: null });
    deleteEqMock.mockResolvedValue({ error: null });
    await mergeCategories('cat-1', 'cat-2');
    expect(billsUpdateMock).toHaveBeenCalledWith({ category_id: 'cat-2' });
    expect(billsUpdateEqMock).toHaveBeenCalledWith('category_id', 'cat-1');
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'cat-1');
  });
});

describe('archiveCategory / unarchiveCategory', () => {
  it('archives by setting archived to true', async () => {
    plainUpdateEqMock.mockResolvedValue({ error: null });
    await archiveCategory('cat-1');
    expect(plainUpdateMock).toHaveBeenCalledWith({ archived: true });
  });

  it('unarchives by setting archived to false', async () => {
    plainUpdateEqMock.mockResolvedValue({ error: null });
    await unarchiveCategory('cat-1');
    expect(plainUpdateMock).toHaveBeenCalledWith({ archived: false });
  });
});
```

*Note on the mock's `update` shape: `updateCategory` needs `.update(payload).eq(id).select().single()` while `archiveCategory`/`deleteCategory`'s reassignment need `.update(payload).eq(col, val)` resolving directly. The mock above threads both through `plainUpdateEqMock`/`updateEqMock` — if this proves awkward once written, simplify by giving `updateCategory` its own dedicated repository call shape (`.update(payload).eq('id', id).select().single()`) and testing it in isolation with a fresh `vi.fn()` per shape, same as `receipts-repository.test.ts` does for its `update`/`updateEq` pair. Prioritize test clarity over cleverness here.*

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/categories-repository.test.ts`
Expected: FAIL — `Cannot find module './categories-repository'`

- [ ] **Step 3: Write the implementation**

`lib/categories-repository.ts`:

```typescript
import { createClient } from './supabase/client';
import type { Category, CategoryIconKey } from './categories-types';

const RELATION_MISSING_CODE = '42P01';

interface CategoryRow {
  id: string;
  name: string;
  icon: string;
  color_slot: number;
  sort_order: number;
  archived: boolean;
  created_at: string;
}

function rowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon as CategoryIconKey,
    colorSlot: row.color_slot,
    sortOrder: row.sort_order,
    archived: row.archived,
    createdAt: row.created_at,
  };
}

export async function listCategories(): Promise<Category[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from('categories').select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as CategoryRow[]).map(rowToCategory);
}

export async function createCategory(input: { name: string; icon: CategoryIconKey; colorSlot: number }): Promise<Category> {
  const supabase = createClient();
  const { data: existing, error: orderError } = await supabase
    .from('categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);
  if (orderError) throw orderError;
  const nextSortOrder = existing && existing.length > 0 ? (existing[0] as { sort_order: number }).sort_order + 1 : 0;

  const { data, error } = await supabase
    .from('categories')
    .insert({ name: input.name, icon: input.icon, color_slot: input.colorSlot, sort_order: nextSortOrder })
    .select()
    .single();
  if (error) throw error;
  return rowToCategory(data as CategoryRow);
}

export async function updateCategory(
  id: string,
  patch: Partial<Pick<Category, 'name' | 'icon' | 'colorSlot'>>
): Promise<Category> {
  const supabase = createClient();
  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.icon !== undefined) payload.icon = patch.icon;
  if (patch.colorSlot !== undefined) payload.color_slot = patch.colorSlot;

  const { data, error } = await supabase.from('categories').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return rowToCategory(data as CategoryRow);
}

export async function archiveCategory(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('categories').update({ archived: true }).eq('id', id);
  if (error) throw error;
}

export async function unarchiveCategory(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('categories').update({ archived: false }).eq('id', id);
  if (error) throw error;
}

export async function countBillsUsingCategory(categoryId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase.from('bills').select('id', { count: 'exact', head: true }).eq('category_id', categoryId);
  if (error) {
    if ((error as { code?: string }).code === RELATION_MISSING_CODE) return 0;
    throw error;
  }
  return count ?? 0;
}

export async function deleteCategory(id: string, reassignToId?: string): Promise<void> {
  const supabase = createClient();
  if (reassignToId) {
    const { error: reassignError } = await supabase.from('bills').update({ category_id: reassignToId }).eq('category_id', id);
    if (reassignError && (reassignError as { code?: string }).code !== RELATION_MISSING_CODE) throw reassignError;
  }
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

export async function mergeCategories(sourceId: string, targetId: string): Promise<void> {
  const supabase = createClient();
  const { error: reassignError } = await supabase.from('bills').update({ category_id: targetId }).eq('category_id', sourceId);
  if (reassignError && (reassignError as { code?: string }).code !== RELATION_MISSING_CODE) throw reassignError;
  const { error } = await supabase.from('categories').delete().eq('id', sourceId);
  if (error) throw error;
}

export async function reorderCategories(orderedIds: string[]): Promise<void> {
  const supabase = createClient();
  const results = await Promise.all(
    orderedIds.map((id, index) => supabase.from('categories').update({ sort_order: index }).eq('id', id))
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/categories-repository.test.ts`
Expected: PASS (all tests). If the shared mock's `update` shape from Step 1 doesn't cleanly support both call sites, split it into two `vi.fn()` chains as the note in Step 1 suggests, adjust the corresponding test expectations, and re-run until green — the implementation in Step 3 does not change either way.

- [ ] **Step 5: Commit**

```bash
git add lib/categories-repository.ts lib/categories-repository.test.ts
git commit -m "feat: add categories repository"
```

---

### Task 5: use-categories hook

**Files:**
- Create: `lib/use-categories.ts`
- Test: `lib/use-categories.test.ts`

**Interfaces:**
- Consumes: all functions from `lib/categories-repository.ts` (Task 4), `Category`/`CategoryIconKey` from Task 1
- Produces: `useCategories(): { categories: Category[]; activeCategories: Category[]; archivedCategories: Category[]; loading: boolean; error: string | null; refresh: () => Promise<void>; create: (input: { name: string; icon: CategoryIconKey; colorSlot: number }) => Promise<void>; update: (id: string, patch: Partial<Pick<Category, 'name' | 'icon' | 'colorSlot'>>) => Promise<void>; archive: (id: string) => Promise<void>; unarchive: (id: string) => Promise<void>; remove: (id: string, reassignToId?: string) => Promise<void>; merge: (sourceId: string, targetId: string) => Promise<void>; reorder: (orderedIds: string[]) => Promise<void> }`

- [ ] **Step 1: Write the failing test**

`lib/use-categories.test.ts`:

```typescript
import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const listCategoriesMock = vi.fn();
const createCategoryMock = vi.fn();
const archiveCategoryMock = vi.fn();
const reorderCategoriesMock = vi.fn();

vi.mock('./categories-repository', () => ({
  listCategories: listCategoriesMock,
  createCategory: createCategoryMock,
  updateCategory: vi.fn(),
  archiveCategory: archiveCategoryMock,
  unarchiveCategory: vi.fn(),
  deleteCategory: vi.fn(),
  mergeCategories: vi.fn(),
  reorderCategories: reorderCategoriesMock,
}));

import { useCategories } from './use-categories';

const activeCategory = { id: 'cat-1', name: 'Housing', icon: 'building-2', colorSlot: 1, sortOrder: 0, archived: false, createdAt: '2026-08-15T10:00:00.000Z' };
const archivedCategory = { id: 'cat-2', name: 'Old', icon: 'gift', colorSlot: 2, sortOrder: 1, archived: true, createdAt: '2026-08-15T10:00:00.000Z' };

afterEach(() => {
  vi.clearAllMocks();
});

describe('useCategories', () => {
  it('loads categories on mount and splits active/archived', async () => {
    listCategoriesMock.mockResolvedValue([activeCategory, archivedCategory]);
    const { result } = renderHook(() => useCategories());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.categories).toHaveLength(2);
    expect(result.current.activeCategories).toEqual([activeCategory]);
    expect(result.current.archivedCategories).toEqual([archivedCategory]);
    expect(result.current.error).toBeNull();
  });

  it('sets an error message when loading fails', async () => {
    listCategoriesMock.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('network down');
  });

  it('create() calls the repository and refreshes the list', async () => {
    listCategoriesMock.mockResolvedValueOnce([]).mockResolvedValueOnce([activeCategory]);
    createCategoryMock.mockResolvedValue(activeCategory);
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.create({ name: 'Housing', icon: 'building-2', colorSlot: 1 });
    });

    expect(createCategoryMock).toHaveBeenCalledWith({ name: 'Housing', icon: 'building-2', colorSlot: 1 });
    expect(result.current.categories).toEqual([activeCategory]);
  });

  it('surfaces a mutation error without crashing', async () => {
    listCategoriesMock.mockResolvedValue([]);
    archiveCategoryMock.mockRejectedValue(new Error('cannot archive'));
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.archive('cat-1')).rejects.toThrow('cannot archive');
    });

    expect(result.current.error).toBe('cannot archive');
  });

  it('reorder() calls the repository with the given id order', async () => {
    listCategoriesMock.mockResolvedValue([]);
    reorderCategoriesMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.reorder(['cat-2', 'cat-1']);
    });

    expect(reorderCategoriesMock).toHaveBeenCalledWith(['cat-2', 'cat-1']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/use-categories.test.ts`
Expected: FAIL — `Cannot find module './use-categories'`

- [ ] **Step 3: Write the implementation**

`lib/use-categories.ts`:

```typescript
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  listCategories,
  createCategory,
  updateCategory,
  archiveCategory,
  unarchiveCategory,
  deleteCategory,
  mergeCategories,
  reorderCategories,
} from './categories-repository';
import type { Category, CategoryIconKey } from './categories-types';

export interface UseCategoriesResult {
  categories: Category[];
  activeCategories: Category[];
  archivedCategories: Category[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (input: { name: string; icon: CategoryIconKey; colorSlot: number }) => Promise<void>;
  update: (id: string, patch: Partial<Pick<Category, 'name' | 'icon' | 'colorSlot'>>) => Promise<void>;
  archive: (id: string) => Promise<void>;
  unarchive: (id: string) => Promise<void>;
  remove: (id: string, reassignToId?: string) => Promise<void>;
  merge: (sourceId: string, targetId: string) => Promise<void>;
  reorder: (orderedIds: string[]) => Promise<void>;
}

export function useCategories(): UseCategoriesResult {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCategories(await listCategories());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runMutation = useCallback(
    async (fn: () => Promise<unknown>) => {
      setError(null);
      try {
        await fn();
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Action failed';
        setError(message);
        throw err;
      }
    },
    [refresh]
  );

  return {
    categories,
    activeCategories: categories.filter((c) => !c.archived),
    archivedCategories: categories.filter((c) => c.archived),
    loading,
    error,
    refresh,
    create: (input) => runMutation(() => createCategory(input)),
    update: (id, patch) => runMutation(() => updateCategory(id, patch)),
    archive: (id) => runMutation(() => archiveCategory(id)),
    unarchive: (id) => runMutation(() => unarchiveCategory(id)),
    remove: (id, reassignToId) => runMutation(() => deleteCategory(id, reassignToId)),
    merge: (sourceId, targetId) => runMutation(() => mergeCategories(sourceId, targetId)),
    reorder: (orderedIds) => runMutation(() => reorderCategories(orderedIds)),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/use-categories.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/use-categories.ts lib/use-categories.test.ts
git commit -m "feat: add use-categories hook"
```

---

### Task 6: Re-key Budget mock data by name + rewire use-budget

**Files:**
- Modify: `lib/budget-data.ts` (full rewrite)
- Modify: `lib/budget-data.test.ts`
- Modify: `lib/use-budget.ts` (full rewrite)
- Modify: `lib/use-budget.test.ts`
- Modify: `lib/budget-types.ts:1-10` (drop `icon: LucideIcon` — icon now comes from `Category`/`ICON_MAP`)

**Interfaces:**
- Consumes: `useCategories()` from Task 5, `ICON_MAP` from Task 2
- Produces: `useBudget(): { categories: BudgetCategory[]; totals: BudgetTotals; loading: boolean; error: string | null }` where `BudgetCategory` now carries `colorSlot`/`icon` sourced from the live `Category`, plus `limit`/`spent` from the mock lookup

- [ ] **Step 1: Update budget-types.ts**

Edit `lib/budget-types.ts`:

```typescript
import type { LucideIcon } from 'lucide-react';

export interface BudgetCategory {
  id: string;
  name: string;
  icon: LucideIcon;
  colorSlot: number;
  limit: number;
  spent: number;
}
```

(Widen `colorSlot` from the literal `1 | 2 | 3 | 4 | 5 | 6` to `number`, since categories now go up to slot 12 and are user-defined.)

- [ ] **Step 2: Write the failing test for the re-keyed mock data**

Edit `lib/budget-data.test.ts` — replace its contents:

```typescript
import { describe, expect, it } from 'vitest';
import { budgetAmountsByCategoryName } from './budget-data';

describe('budgetAmountsByCategoryName', () => {
  it('has an entry for each of the 6 default categories', () => {
    ['Housing', 'Groceries', 'Transport', 'Entertainment', 'Utilities', 'Shopping'].forEach((name) => {
      expect(budgetAmountsByCategoryName[name]).toBeDefined();
      expect(budgetAmountsByCategoryName[name].limit).toBeGreaterThan(0);
    });
  });

  it('keeps the same limit/spent values as before the re-key', () => {
    expect(budgetAmountsByCategoryName['Housing']).toEqual({ limit: 1450, spent: 1450 });
    expect(budgetAmountsByCategoryName['Shopping']).toEqual({ limit: 300, spent: 95 });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- lib/budget-data.test.ts`
Expected: FAIL — `budgetAmountsByCategoryName is not exported` / old exports gone

- [ ] **Step 4: Rewrite budget-data.ts**

`lib/budget-data.ts` (full contents):

```typescript
export const budgetAmountsByCategoryName: Record<string, { limit: number; spent: number }> = {
  Housing: { limit: 1450, spent: 1450 },
  Groceries: { limit: 500, spent: 468 },
  Transport: { limit: 200, spent: 145 },
  Entertainment: { limit: 120, spent: 138 },
  Utilities: { limit: 220, spent: 190 },
  Shopping: { limit: 300, spent: 95 },
};

export const DEFAULT_BUDGET_AMOUNTS = { limit: 0, spent: 0 };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- lib/budget-data.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Write the failing test for the rewired hook**

`lib/use-budget.test.ts` (full contents):

```typescript
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const activeCategory = (overrides: Partial<{ id: string; name: string; icon: string; colorSlot: number; sortOrder: number }> = {}) => ({
  id: 'cat-1',
  name: 'Housing',
  icon: 'building-2',
  colorSlot: 1,
  sortOrder: 0,
  archived: false,
  createdAt: '2026-08-15T10:00:00.000Z',
  ...overrides,
});

const useCategoriesMock = vi.fn();
vi.mock('./use-categories', () => ({
  useCategories: () => useCategoriesMock(),
}));

import { useBudget } from './use-budget';

describe('useBudget', () => {
  it('joins live categories with mock limit/spent by name', () => {
    useCategoriesMock.mockReturnValue({
      activeCategories: [activeCategory({ id: 'cat-1', name: 'Housing', colorSlot: 1 })],
      loading: false,
      error: null,
    });
    const { result } = renderHook(() => useBudget());
    expect(result.current.categories).toEqual([
      expect.objectContaining({ id: 'cat-1', name: 'Housing', colorSlot: 1, limit: 1450, spent: 1450 }),
    ]);
  });

  it('defaults limit/spent to 0 for a category not in the mock seed', () => {
    useCategoriesMock.mockReturnValue({
      activeCategories: [activeCategory({ id: 'cat-9', name: 'Pet Care', colorSlot: 9 })],
      loading: false,
      error: null,
    });
    const { result } = renderHook(() => useBudget());
    expect(result.current.categories[0]).toEqual(expect.objectContaining({ limit: 0, spent: 0 }));
  });

  it('computes budgeted/spent/remaining totals', () => {
    useCategoriesMock.mockReturnValue({
      activeCategories: [activeCategory({ id: 'cat-1', name: 'Housing' }), activeCategory({ id: 'cat-2', name: 'Groceries', colorSlot: 2 })],
      loading: false,
      error: null,
    });
    const { result } = renderHook(() => useBudget());
    expect(result.current.totals).toEqual({ budgeted: 1950, spent: 1918, remaining: 32 });
  });

  it('passes through loading and error from useCategories', () => {
    useCategoriesMock.mockReturnValue({ activeCategories: [], loading: true, error: 'boom' });
    const { result } = renderHook(() => useBudget());
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe('boom');
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test -- lib/use-budget.test.ts`
Expected: FAIL — old `useBudget` reads `budgetCategories`, doesn't call `useCategories`

- [ ] **Step 8: Rewrite use-budget.ts**

`lib/use-budget.ts` (full contents):

```typescript
'use client';

import { useMemo } from 'react';
import { useCategories } from './use-categories';
import { budgetAmountsByCategoryName, DEFAULT_BUDGET_AMOUNTS } from './budget-data';
import { ICON_MAP } from './category-icons';
import type { BudgetCategory } from './budget-types';

export interface BudgetTotals {
  budgeted: number;
  spent: number;
  remaining: number;
}

export function useBudget(): { categories: BudgetCategory[]; totals: BudgetTotals; loading: boolean; error: string | null } {
  const { activeCategories, loading, error } = useCategories();

  const categories = useMemo<BudgetCategory[]>(
    () =>
      activeCategories.map((category) => {
        const amounts = budgetAmountsByCategoryName[category.name] ?? DEFAULT_BUDGET_AMOUNTS;
        return {
          id: category.id,
          name: category.name,
          icon: ICON_MAP[category.icon],
          colorSlot: category.colorSlot,
          limit: amounts.limit,
          spent: amounts.spent,
        };
      }),
    [activeCategories]
  );

  const totals = useMemo<BudgetTotals>(() => {
    const budgeted = categories.reduce((sum, c) => sum + c.limit, 0);
    const spent = categories.reduce((sum, c) => sum + c.spent, 0);
    return { budgeted, spent, remaining: budgeted - spent };
  }, [categories]);

  return { categories, totals, loading, error };
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test -- lib/use-budget.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 10: Run the full Budget page test suite for regressions**

Run: `npm test -- "app/(shell)/budget/page.test.tsx" components/budget`
Expected: PASS. If `app/(shell)/budget/page.test.tsx` mocks `./use-budget` or `./budget-data` directly with the old shape, update its mock return value to include `loading: false, error: null` alongside `categories`/`totals` so the page (Task 12 will add loading/error handling there) doesn't break.

- [ ] **Step 11: Commit**

```bash
git add lib/budget-types.ts lib/budget-data.ts lib/budget-data.test.ts lib/use-budget.ts lib/use-budget.test.ts "app/(shell)/budget/page.test.tsx"
git commit -m "feat: source Budget categories from the live categories table"
```

---

### Task 7: Pure reorder helper

**Files:**
- Create: `lib/categories-reorder.ts`
- Test: `lib/categories-reorder.test.ts`

**Interfaces:**
- Produces: `reorderIds(ids: string[], activeId: string, overId: string): string[]`

- [ ] **Step 1: Write the failing test**

`lib/categories-reorder.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { reorderIds } from './categories-reorder';

describe('reorderIds', () => {
  it('moves the active item to the position of the over item, shifting the rest', () => {
    expect(reorderIds(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an item earlier in the list', () => {
    expect(reorderIds(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c']);
  });

  it('returns the same order when active and over are the same', () => {
    expect(reorderIds(['a', 'b', 'c'], 'b', 'b')).toEqual(['a', 'b', 'c']);
  });

  it('returns the original array unchanged when either id is not found', () => {
    expect(reorderIds(['a', 'b', 'c'], 'x', 'b')).toEqual(['a', 'b', 'c']);
    expect(reorderIds(['a', 'b', 'c'], 'a', 'x')).toEqual(['a', 'b', 'c']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/categories-reorder.test.ts`
Expected: FAIL — `Cannot find module './categories-reorder'`

- [ ] **Step 3: Write the implementation**

`lib/categories-reorder.ts`:

```typescript
export function reorderIds(ids: string[], activeId: string, overId: string): string[] {
  const fromIndex = ids.indexOf(activeId);
  const toIndex = ids.indexOf(overId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return ids;

  const next = [...ids];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/categories-reorder.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/categories-reorder.ts lib/categories-reorder.test.ts
git commit -m "feat: add pure reorderIds helper for drag-and-drop"
```

---

### Task 8: Install dnd-kit + CategoryList component

**Files:**
- Modify: `package.json` (add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`)
- Create: `components/categories/CategoryList.tsx`
- Test: `components/categories/CategoryList.test.tsx`

**Interfaces:**
- Consumes: `Category` from Task 1, `ICON_MAP` from Task 2, `DOT_COLOR_CLASS` from Task 3, `reorderIds` from Task 7
- Produces: `CategoryList` component, props `{ categories: Category[]; onReorder: (orderedIds: string[]) => void; onEdit: (category: Category) => void; onArchive: (id: string) => void; onUnarchive: (id: string) => void; onDelete: (category: Category) => void }`

- [ ] **Step 1: Install dnd-kit**

```bash
cd "/Users/kendrickynanflores/Documents/Personal/Claude/Financial Tracker"
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected: `package.json`/`package-lock.json` updated with the three new dependencies.

- [ ] **Step 2: Write the failing test**

`components/categories/CategoryList.test.tsx`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoryList } from './CategoryList';
import type { Category } from '@/lib/categories-types';

const categories: Category[] = [
  { id: 'cat-1', name: 'Housing', icon: 'building-2', colorSlot: 1, sortOrder: 0, archived: false, createdAt: '2026-08-15T10:00:00.000Z' },
  { id: 'cat-2', name: 'Groceries', icon: 'shopping-cart', colorSlot: 2, sortOrder: 1, archived: false, createdAt: '2026-08-15T10:00:00.000Z' },
];

const archivedCategory: Category = {
  id: 'cat-3',
  name: 'Old Subscriptions',
  icon: 'gift',
  colorSlot: 3,
  sortOrder: 2,
  archived: true,
  createdAt: '2026-08-15T10:00:00.000Z',
};

const noop = () => {};

describe('CategoryList', () => {
  it('renders each category with its name and a drag handle', () => {
    render(<CategoryList categories={categories} onReorder={noop} onEdit={noop} onArchive={noop} onUnarchive={noop} onDelete={noop} />);
    expect(screen.getByText('Housing')).toBeInTheDocument();
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getAllByTestId('category-drag-handle')).toHaveLength(2);
  });

  it('renders in the given order', () => {
    render(<CategoryList categories={categories} onReorder={noop} onEdit={noop} onArchive={noop} onUnarchive={noop} onDelete={noop} />);
    const rows = screen.getAllByTestId('category-row');
    expect(rows[0]).toHaveTextContent('Housing');
    expect(rows[1]).toHaveTextContent('Groceries');
  });

  it('shows an "Archived" badge and no drag handle for archived categories', () => {
    render(<CategoryList categories={[archivedCategory]} onReorder={noop} onEdit={noop} onArchive={noop} onUnarchive={noop} onDelete={noop} />);
    expect(screen.getByText('Archived')).toBeInTheDocument();
    expect(screen.queryByTestId('category-drag-handle')).not.toBeInTheDocument();
  });

  it('calls onEdit when the edit action is clicked', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<CategoryList categories={categories} onReorder={noop} onEdit={onEdit} onArchive={noop} onUnarchive={noop} onDelete={noop} />);
    await user.click(screen.getAllByRole('button', { name: /edit housing/i })[0]);
    expect(onEdit).toHaveBeenCalledWith(categories[0]);
  });

  it('calls onArchive for an active category and onUnarchive for an archived one', async () => {
    const onArchive = vi.fn();
    const onUnarchive = vi.fn();
    const user = userEvent.setup();
    render(<CategoryList categories={[categories[0], archivedCategory]} onReorder={noop} onEdit={noop} onArchive={onArchive} onUnarchive={onUnarchive} onDelete={noop} />);
    await user.click(screen.getByRole('button', { name: /archive housing/i }));
    expect(onArchive).toHaveBeenCalledWith('cat-1');
    await user.click(screen.getByRole('button', { name: /unarchive old subscriptions/i }));
    expect(onUnarchive).toHaveBeenCalledWith('cat-3');
  });

  it('calls onDelete with the full category when the delete action is clicked', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<CategoryList categories={categories} onReorder={noop} onEdit={noop} onArchive={noop} onUnarchive={noop} onDelete={onDelete} />);
    await user.click(screen.getAllByRole('button', { name: /delete housing/i })[0]);
    expect(onDelete).toHaveBeenCalledWith(categories[0]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- components/categories/CategoryList.test.tsx`
Expected: FAIL — `Cannot find module './CategoryList'`

- [ ] **Step 4: Write the implementation**

`components/categories/CategoryList.tsx`:

```typescript
'use client';

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ICON_MAP } from '@/lib/category-icons';
import { DOT_COLOR_CLASS } from '@/lib/category-colors';
import { reorderIds } from '@/lib/categories-reorder';
import type { Category } from '@/lib/categories-types';

interface CategoryListProps {
  categories: Category[];
  onReorder: (orderedIds: string[]) => void;
  onEdit: (category: Category) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onDelete: (category: Category) => void;
}

export function CategoryList({ categories, onReorder, onEdit, onArchive, onUnarchive, onDelete }: CategoryListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const overId = event.over?.id;
    if (!overId) return;
    const activeId = String(event.active.id);
    const next = reorderIds(
      categories.map((c) => c.id),
      activeId,
      String(overId)
    );
    if (next.join() !== categories.map((c) => c.id).join()) onReorder(next);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-2">
          {categories.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              onEdit={onEdit}
              onArchive={onArchive}
              onUnarchive={onUnarchive}
              onDelete={onDelete}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function CategoryRow({
  category,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  category: Category;
  onEdit: (category: Category) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onDelete: (category: Category) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: category.id, disabled: category.archived });
  const Icon = ICON_MAP[category.icon];
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-testid="category-row"
      className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3"
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
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${DOT_COLOR_CLASS[category.colorSlot]}`}>
        <Icon className="h-4 w-4 text-white" />
      </span>
      <span className="flex-1 text-sm font-medium text-neutral-900">{category.name}</span>
      {category.archived && (
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">Archived</span>
      )}
      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${category.name}`} onClick={() => onEdit(category)}>
        <Pencil className="h-4 w-4" />
      </Button>
      {category.archived ? (
        <Button variant="ghost" size="icon-sm" aria-label={`Unarchive ${category.name}`} onClick={() => onUnarchive(category.id)}>
          <ArchiveRestore className="h-4 w-4" />
        </Button>
      ) : (
        <Button variant="ghost" size="icon-sm" aria-label={`Archive ${category.name}`} onClick={() => onArchive(category.id)}>
          <Archive className="h-4 w-4" />
        </Button>
      )}
      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${category.name}`} onClick={() => onDelete(category)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- components/categories/CategoryList.test.tsx`
Expected: PASS (6 tests). Actual pointer/keyboard drag behavior isn't simulated here (jsdom doesn't reliably support dnd-kit's pointer sensor); reorder *correctness* is already covered by `lib/categories-reorder.test.ts` in Task 7, and this component wires `handleDragEnd` straight to that pure function.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json components/categories/CategoryList.tsx components/categories/CategoryList.test.tsx
git commit -m "feat: add drag-reorderable CategoryList component"
```

---

### Task 9: CategoryForm (add/edit)

**Files:**
- Create: `components/categories/CategoryForm.tsx`
- Test: `components/categories/CategoryForm.test.tsx`

**Interfaces:**
- Consumes: `CATEGORY_ICON_KEYS`/`ICON_MAP` from Task 2, `CATEGORY_COLOR_SLOTS`/`DOT_COLOR_CLASS` from Task 3, `Category`/`CategoryIconKey` from Task 1, `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle`/`SheetFooter` from `components/ui/sheet.tsx`, `Input`/`Label`/`Button` from `components/ui`
- Produces: `CategoryForm` component, props `{ open: boolean; onOpenChange: (open: boolean) => void; initialCategory?: Category; onSubmit: (input: { name: string; icon: CategoryIconKey; colorSlot: number }) => Promise<void> }`

- [ ] **Step 1: Write the failing test**

`components/categories/CategoryForm.test.tsx`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoryForm } from './CategoryForm';
import type { Category } from '@/lib/categories-types';

const existingCategory: Category = {
  id: 'cat-1',
  name: 'Housing',
  icon: 'building-2',
  colorSlot: 1,
  sortOrder: 0,
  archived: false,
  createdAt: '2026-08-15T10:00:00.000Z',
};

describe('CategoryForm', () => {
  it('renders empty fields for a new category', () => {
    render(<CategoryForm open onOpenChange={() => {}} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/name/i)).toHaveValue('');
    expect(screen.getByRole('heading', { name: /add category/i })).toBeInTheDocument();
  });

  it('pre-fills fields when editing an existing category', () => {
    render(<CategoryForm open onOpenChange={() => {}} initialCategory={existingCategory} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/name/i)).toHaveValue('Housing');
    expect(screen.getByRole('heading', { name: /edit category/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /building 2 icon/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /color 1/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('disables submit until a name is entered', async () => {
    const user = userEvent.setup();
    render(<CategoryForm open onOpenChange={() => {}} onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/name/i), 'Pet Care');
    expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
  });

  it('calls onSubmit with the name, selected icon, and selected color', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CategoryForm open onOpenChange={() => {}} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/name/i), 'Pet Care');
    await user.click(screen.getByRole('button', { name: /paw print icon/i }));
    await user.click(screen.getByRole('button', { name: /color 9/i }));
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledWith({ name: 'Pet Care', icon: 'paw-print', colorSlot: 9 });
  });

  it('defaults to the first icon and color when adding a new category', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CategoryForm open onOpenChange={() => {}} onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/name/i), 'Pet Care');
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Pet Care', icon: 'building-2', colorSlot: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/categories/CategoryForm.test.tsx`
Expected: FAIL — `Cannot find module './CategoryForm'`

- [ ] **Step 3: Write the implementation**

`components/categories/CategoryForm.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CATEGORY_ICON_KEYS, ICON_MAP } from '@/lib/category-icons';
import { CATEGORY_COLOR_SLOTS, DOT_COLOR_CLASS } from '@/lib/category-colors';
import type { Category, CategoryIconKey } from '@/lib/categories-types';

interface CategoryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCategory?: Category;
  onSubmit: (input: { name: string; icon: CategoryIconKey; colorSlot: number }) => Promise<void>;
}

function iconLabel(key: CategoryIconKey): string {
  return `${key.replace(/-/g, ' ')} icon`;
}

export function CategoryForm({ open, onOpenChange, initialCategory, onSubmit }: CategoryFormProps) {
  const [name, setName] = useState(initialCategory?.name ?? '');
  const [icon, setIcon] = useState<CategoryIconKey>(initialCategory?.icon ?? CATEGORY_ICON_KEYS[0]);
  const [colorSlot, setColorSlot] = useState<number>(initialCategory?.colorSlot ?? CATEGORY_COLOR_SLOTS[0]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setName(initialCategory?.name ?? '');
    setIcon(initialCategory?.icon ?? CATEGORY_ICON_KEYS[0]);
    setColorSlot(initialCategory?.colorSlot ?? CATEGORY_COLOR_SLOTS[0]);
  }, [initialCategory, open]);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), icon, colorSlot });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>{initialCategory ? 'Edit category' : 'Add category'}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category-name">Name</Label>
            <Input id="category-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Icon</Label>
            <div className="grid grid-cols-6 gap-2">
              {CATEGORY_ICON_KEYS.map((key) => {
                const Icon = ICON_MAP[key];
                const selected = key === icon;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-label={iconLabel(key)}
                    aria-pressed={selected}
                    onClick={() => setIcon(key)}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border ${selected ? 'border-neutral-900 bg-neutral-100' : 'border-neutral-200'}`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLOR_SLOTS.map((slot) => {
                const selected = slot === colorSlot;
                return (
                  <button
                    key={slot}
                    type="button"
                    aria-label={`Color ${slot}`}
                    aria-pressed={selected}
                    onClick={() => setColorSlot(slot)}
                    className={`h-7 w-7 rounded-full ${DOT_COLOR_CLASS[slot]} ${selected ? 'ring-2 ring-neutral-900 ring-offset-2' : ''}`}
                  />
                );
              })}
            </div>
          </div>
        </div>
        <SheetFooter>
          <Button onClick={handleSubmit} disabled={name.trim() === '' || submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- components/categories/CategoryForm.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add components/categories/CategoryForm.tsx components/categories/CategoryForm.test.tsx
git commit -m "feat: add CategoryForm add/edit sheet"
```

---

### Task 10: DeleteCategoryDialog

**Files:**
- Create: `components/categories/DeleteCategoryDialog.tsx`
- Test: `components/categories/DeleteCategoryDialog.test.tsx`

**Interfaces:**
- Consumes: `Category` from Task 1, `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle`/`SheetFooter` from `components/ui/sheet.tsx`, `Button` from `components/ui/button.tsx`
- Produces: `DeleteCategoryDialog` component, props `{ open: boolean; onOpenChange: (open: boolean) => void; category: Category; billCount: number; otherCategories: Category[]; onConfirm: (reassignToId?: string) => Promise<void> }`

- [ ] **Step 1: Write the failing test**

`components/categories/DeleteCategoryDialog.test.tsx`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteCategoryDialog } from './DeleteCategoryDialog';
import type { Category } from '@/lib/categories-types';

const target: Category = { id: 'cat-1', name: 'Housing', icon: 'building-2', colorSlot: 1, sortOrder: 0, archived: false, createdAt: '2026-08-15T10:00:00.000Z' };
const other: Category = { id: 'cat-2', name: 'Groceries', icon: 'shopping-cart', colorSlot: 2, sortOrder: 1, archived: false, createdAt: '2026-08-15T10:00:00.000Z' };

describe('DeleteCategoryDialog', () => {
  it('enables delete immediately when no bills use the category', () => {
    render(<DeleteCategoryDialog open onOpenChange={() => {}} category={target} billCount={0} otherCategories={[other]} onConfirm={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^delete$/i })).not.toBeDisabled();
    expect(screen.queryByLabelText(/reassign to/i)).not.toBeInTheDocument();
  });

  it('disables delete until a reassignment target is chosen when bills use the category', async () => {
    const user = userEvent.setup();
    render(<DeleteCategoryDialog open onOpenChange={() => {}} category={target} billCount={4} otherCategories={[other]} onConfirm={vi.fn()} />);
    expect(screen.getByText(/4 bills/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText(/reassign to/i), 'cat-2');
    expect(screen.getByRole('button', { name: /^delete$/i })).not.toBeDisabled();
  });

  it('calls onConfirm without an id when there is nothing to reassign', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<DeleteCategoryDialog open onOpenChange={() => {}} category={target} billCount={0} otherCategories={[other]} onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });

  it('calls onConfirm with the chosen reassignment id', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<DeleteCategoryDialog open onOpenChange={() => {}} category={target} billCount={4} otherCategories={[other]} onConfirm={onConfirm} />);
    await user.selectOptions(screen.getByLabelText(/reassign to/i), 'cat-2');
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(onConfirm).toHaveBeenCalledWith('cat-2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/categories/DeleteCategoryDialog.test.tsx`
Expected: FAIL — `Cannot find module './DeleteCategoryDialog'`

- [ ] **Step 3: Write the implementation**

`components/categories/DeleteCategoryDialog.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { Category } from '@/lib/categories-types';

interface DeleteCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category;
  billCount: number;
  otherCategories: Category[];
  onConfirm: (reassignToId?: string) => Promise<void>;
}

export function DeleteCategoryDialog({ open, onOpenChange, category, billCount, otherCategories, onConfirm }: DeleteCategoryDialogProps) {
  const [reassignToId, setReassignToId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const needsReassignment = billCount > 0;
  const canDelete = !needsReassignment || reassignToId !== '';

  async function handleDelete() {
    setSubmitting(true);
    try {
      await onConfirm(needsReassignment ? reassignToId : undefined);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Delete {category.name}?</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          {needsReassignment ? (
            <>
              <p className="text-sm text-neutral-600">
                {billCount} {billCount === 1 ? 'bill uses' : 'bills use'} this category. Choose where to move them before deleting.
              </p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reassign-select">Reassign to</Label>
                <select
                  id="reassign-select"
                  data-testid="reassign-select"
                  value={reassignToId}
                  onChange={(e) => setReassignToId(e.target.value)}
                  className="h-8 rounded-lg border border-neutral-200 px-2 text-sm"
                >
                  <option value="">Select a category</option>
                  {otherCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <p className="text-sm text-neutral-600">This category isn&apos;t used by any bills. This can&apos;t be undone.</p>
          )}
        </div>
        <SheetFooter>
          <Button variant="destructive" onClick={handleDelete} disabled={!canDelete || submitting}>
            Delete
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- components/categories/DeleteCategoryDialog.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add components/categories/DeleteCategoryDialog.tsx components/categories/DeleteCategoryDialog.test.tsx
git commit -m "feat: add DeleteCategoryDialog with reassignment guard"
```

---

### Task 11: MergeCategoriesDialog

**Files:**
- Create: `components/categories/MergeCategoriesDialog.tsx`
- Test: `components/categories/MergeCategoriesDialog.test.tsx`

**Interfaces:**
- Consumes: `Category` from Task 1, `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle`/`SheetFooter` from `components/ui/sheet.tsx`, `Button`/`Label` from `components/ui`
- Produces: `MergeCategoriesDialog` component, props `{ open: boolean; onOpenChange: (open: boolean) => void; categories: Category[]; onConfirm: (sourceId: string, targetId: string) => Promise<void> }`

- [ ] **Step 1: Write the failing test**

`components/categories/MergeCategoriesDialog.test.tsx`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MergeCategoriesDialog } from './MergeCategoriesDialog';
import type { Category } from '@/lib/categories-types';

const categories: Category[] = [
  { id: 'cat-1', name: 'Housing', icon: 'building-2', colorSlot: 1, sortOrder: 0, archived: false, createdAt: '2026-08-15T10:00:00.000Z' },
  { id: 'cat-2', name: 'Rent', icon: 'building-2', colorSlot: 1, sortOrder: 1, archived: false, createdAt: '2026-08-15T10:00:00.000Z' },
];

describe('MergeCategoriesDialog', () => {
  it('disables confirm until both source and target are chosen', async () => {
    const user = userEvent.setup();
    render(<MergeCategoriesDialog open onOpenChange={() => {}} categories={categories} onConfirm={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^merge$/i })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText(/merge this category/i), 'cat-1');
    expect(screen.getByRole('button', { name: /^merge$/i })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText(/into this category/i), 'cat-2');
    expect(screen.getByRole('button', { name: /^merge$/i })).not.toBeDisabled();
  });

  it('disables confirm when source and target are the same', async () => {
    const user = userEvent.setup();
    render(<MergeCategoriesDialog open onOpenChange={() => {}} categories={categories} onConfirm={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText(/merge this category/i), 'cat-1');
    await user.selectOptions(screen.getByLabelText(/into this category/i), 'cat-1');
    expect(screen.getByRole('button', { name: /^merge$/i })).toBeDisabled();
  });

  it('calls onConfirm with source and target ids', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<MergeCategoriesDialog open onOpenChange={() => {}} categories={categories} onConfirm={onConfirm} />);
    await user.selectOptions(screen.getByLabelText(/merge this category/i), 'cat-1');
    await user.selectOptions(screen.getByLabelText(/into this category/i), 'cat-2');
    await user.click(screen.getByRole('button', { name: /^merge$/i }));
    expect(onConfirm).toHaveBeenCalledWith('cat-1', 'cat-2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/categories/MergeCategoriesDialog.test.tsx`
Expected: FAIL — `Cannot find module './MergeCategoriesDialog'`

- [ ] **Step 3: Write the implementation**

`components/categories/MergeCategoriesDialog.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { Category } from '@/lib/categories-types';

interface MergeCategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onConfirm: (sourceId: string, targetId: string) => Promise<void>;
}

export function MergeCategoriesDialog({ open, onOpenChange, categories, onConfirm }: MergeCategoriesDialogProps) {
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const canMerge = sourceId !== '' && targetId !== '' && sourceId !== targetId;

  async function handleMerge() {
    setSubmitting(true);
    try {
      await onConfirm(sourceId, targetId);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Merge categories</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <p className="text-sm text-neutral-600">All bills using the first category move to the second, then the first is deleted.</p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="merge-source">Merge this category</Label>
            <select
              id="merge-source"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="h-8 rounded-lg border border-neutral-200 px-2 text-sm"
            >
              <option value="">Select a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="merge-target">Into this category</Label>
            <select
              id="merge-target"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="h-8 rounded-lg border border-neutral-200 px-2 text-sm"
            >
              <option value="">Select a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <SheetFooter>
          <Button onClick={handleMerge} disabled={!canMerge || submitting}>
            Merge
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- components/categories/MergeCategoriesDialog.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add components/categories/MergeCategoriesDialog.tsx components/categories/MergeCategoriesDialog.test.tsx
git commit -m "feat: add MergeCategoriesDialog"
```

---

### Task 12: Manage Categories page + Budget gear-icon link

**Files:**
- Create: `app/(shell)/budget/categories/page.tsx`
- Test: `app/(shell)/budget/categories/page.test.tsx`
- Modify: `app/(shell)/budget/page.tsx`
- Modify: `app/(shell)/budget/page.test.tsx`

**Interfaces:**
- Consumes: `useCategories` from Task 5, `countBillsUsingCategory` from Task 4, `CategoryList` from Task 8, `CategoryForm` from Task 9, `DeleteCategoryDialog` from Task 10, `MergeCategoriesDialog` from Task 11

- [ ] **Step 1: Write the failing test**

`app/(shell)/budget/categories/page.test.tsx`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const activeCategory = { id: 'cat-1', name: 'Housing', icon: 'building-2', colorSlot: 1, sortOrder: 0, archived: false, createdAt: '2026-08-15T10:00:00.000Z' };

const createMock = vi.fn().mockResolvedValue(undefined);
const reorderMock = vi.fn().mockResolvedValue(undefined);
const archiveMock = vi.fn().mockResolvedValue(undefined);
const removeMock = vi.fn().mockResolvedValue(undefined);
const mergeMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/use-categories', () => ({
  useCategories: () => ({
    categories: [activeCategory],
    activeCategories: [activeCategory],
    archivedCategories: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
    create: createMock,
    update: vi.fn(),
    archive: archiveMock,
    unarchive: vi.fn(),
    remove: removeMock,
    merge: mergeMock,
    reorder: reorderMock,
  }),
}));

vi.mock('@/lib/categories-repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/categories-repository')>();
  return { ...actual, countBillsUsingCategory: vi.fn().mockResolvedValue(0) };
});

import CategoriesPage from './page';

describe('CategoriesPage', () => {
  it('renders the category list and an Add Category button', () => {
    render(<CategoriesPage />);
    expect(screen.getByText('Housing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add category/i })).toBeInTheDocument();
  });

  it('renders a Merge Categories button', () => {
    render(<CategoriesPage />);
    expect(screen.getByRole('button', { name: /merge categories/i })).toBeInTheDocument();
  });

  it('opens the add form when Add Category is clicked', async () => {
    const user = userEvent.setup();
    render(<CategoriesPage />);
    await user.click(screen.getByRole('button', { name: /add category/i }));
    expect(screen.getByRole('heading', { name: /add category/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- "app/(shell)/budget/categories/page.test.tsx"`
Expected: FAIL — `Cannot find module './page'`

- [ ] **Step 3: Write the implementation**

`app/(shell)/budget/categories/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Merge, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CategoryList } from '@/components/categories/CategoryList';
import { CategoryForm } from '@/components/categories/CategoryForm';
import { DeleteCategoryDialog } from '@/components/categories/DeleteCategoryDialog';
import { MergeCategoriesDialog } from '@/components/categories/MergeCategoriesDialog';
import { useCategories } from '@/lib/use-categories';
import { countBillsUsingCategory } from '@/lib/categories-repository';
import type { Category } from '@/lib/categories-types';

export default function CategoriesPage() {
  const { categories, activeCategories, archivedCategories, loading, error, create, update, archive, unarchive, remove, merge, reorder } =
    useCategories();

  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteBillCount, setDeleteBillCount] = useState(0);
  const [mergeOpen, setMergeOpen] = useState(false);

  function openAddForm() {
    setEditingCategory(undefined);
    setFormOpen(true);
  }

  function openEditForm(category: Category) {
    setEditingCategory(category);
    setFormOpen(true);
  }

  async function handleSubmit(input: { name: string; icon: Category['icon']; colorSlot: number }) {
    if (editingCategory) {
      await update(editingCategory.id, input);
    } else {
      await create(input);
    }
  }

  async function openDeleteDialog(category: Category) {
    const count = await countBillsUsingCategory(category.id);
    setDeleteBillCount(count);
    setDeleteTarget(category);
  }

  return (
    <div data-testid="categories-page" className="flex flex-col gap-4 px-4 pb-24 pt-4">
      <div className="flex items-center gap-2">
        <Link href="/budget" aria-label="Back to Budget">
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-medium text-neutral-900">Manage Categories</h1>
      </div>

      {error && <p className="text-sm text-status-critical">{error}</p>}

      <div className="flex gap-2">
        <Button onClick={openAddForm}>
          <Plus className="h-4 w-4" />
          Add Category
        </Button>
        <Button variant="outline" onClick={() => setMergeOpen(true)}>
          <Merge className="h-4 w-4" />
          Merge Categories
        </Button>
      </div>

      {!loading && (
        <CategoryList
          categories={activeCategories}
          onReorder={reorder}
          onEdit={openEditForm}
          onArchive={archive}
          onUnarchive={unarchive}
          onDelete={openDeleteDialog}
        />
      )}

      {archivedCategories.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-neutral-500">Archived</h2>
          <CategoryList
            categories={archivedCategories}
            onReorder={reorder}
            onEdit={openEditForm}
            onArchive={archive}
            onUnarchive={unarchive}
            onDelete={openDeleteDialog}
          />
        </div>
      )}

      <CategoryForm open={formOpen} onOpenChange={setFormOpen} initialCategory={editingCategory} onSubmit={handleSubmit} />

      {deleteTarget && (
        <DeleteCategoryDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          category={deleteTarget}
          billCount={deleteBillCount}
          otherCategories={categories.filter((c) => c.id !== deleteTarget.id)}
          onConfirm={(reassignToId) => remove(deleteTarget.id, reassignToId)}
        />
      )}

      <MergeCategoriesDialog open={mergeOpen} onOpenChange={setMergeOpen} categories={categories} onConfirm={merge} />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- "app/(shell)/budget/categories/page.test.tsx"`
Expected: PASS (3 tests)

- [ ] **Step 5: Add the gear-icon link from the Budget page**

Write the failing assertion first — edit `app/(shell)/budget/page.test.tsx`, add:

```typescript
it('links to the Manage Categories screen', () => {
  render(<BudgetPage />);
  expect(screen.getByRole('link', { name: /manage categories/i })).toHaveAttribute('href', '/budget/categories');
});
```

(Adjust this test's surrounding mocks for `useBudget`/`useCategories` to match whatever the rest of the file already sets up post-Task-6; the assertion itself is what's new.)

Run: `npm test -- "app/(shell)/budget/page.test.tsx"`
Expected: FAIL — no such link exists yet

- [ ] **Step 6: Add the link**

Edit `app/(shell)/budget/page.tsx` — add the import and header row:

```typescript
import Link from 'next/link';
import { Settings } from 'lucide-react';
```

Wrap the existing content in a header row with the new link, e.g. change the top of the returned JSX from:

```typescript
<div data-testid="budget-page" className="flex flex-col gap-6 px-4 pb-24 pt-4">
  <BudgetSummary budgeted={totals.budgeted} spent={totals.spent} remaining={totals.remaining} />
```

to:

```typescript
<div data-testid="budget-page" className="flex flex-col gap-6 px-4 pb-24 pt-4">
  <div className="flex justify-end">
    <Link href="/budget/categories" aria-label="Manage Categories" className="text-neutral-500">
      <Settings className="h-5 w-5" />
    </Link>
  </div>
  <BudgetSummary budgeted={totals.budgeted} spent={totals.spent} remaining={totals.remaining} />
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- "app/(shell)/budget/page.test.tsx"`
Expected: PASS

- [ ] **Step 8: Run the full test suite for regressions**

Run: `npm test`
Expected: PASS across the whole suite.

- [ ] **Step 9: Live-verify in the browser**

Start the dev server (kill port 3000 first if already running) and drive it with Playwright per the `run` skill's browser-driven pattern used earlier in this project: log in (`admin@admin.com` / `password123`), navigate to `/budget/categories`, screenshot the list, add a category, edit its icon/color, archive it, unarchive it, delete a category with 0 bills, screenshot after each step. Confirm no console errors.

- [ ] **Step 10: Commit**

```bash
git add "app/(shell)/budget/categories/page.tsx" "app/(shell)/budget/categories/page.test.tsx" "app/(shell)/budget/page.tsx" "app/(shell)/budget/page.test.tsx"
git commit -m "feat: add Manage Categories screen, link from Budget"
```

---

## Backlog (not this plan)

Bills table/migration/repository/UI referencing `category_id` (next spec), Accounts, Reminders, real Budget `limit`/`spent` persistence, category icons/colors beyond the curated sets, undo for delete/merge, Activity Logs/Audit Trail (separate future subsystem — see project memory).
