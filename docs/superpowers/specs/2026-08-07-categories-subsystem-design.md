# Categories Subsystem — Design Spec

First phase of moving Bills off mock data. Bills' category field is currently free text; this phase gives categories a real, shared, editable identity (table + full CRUD UI) so the Bills migration that follows can reference `category_id` instead of a string. Also unblocks Budget from hardcoding its category list.

## Context

Bills/Accounts/Reminders/Budget all run on static in-memory seed arrays (`lib/*-data.ts`), consumed by direct import with local `useState` faking mutation. Receipts was migrated to real Supabase first (table + storage + RLS + repository) and is the reference pattern for everything that follows.

Budget currently hardcodes exactly 6 categories (Housing, Groceries, Transport, Entertainment, Utilities, Shopping) in `lib/budget-data.ts`, each with a `LucideIcon` ref and a `colorSlot: 1-6`. Bills' `category` field is free text that happens to match those 6 names but has no real link.

User wants full category management: create/edit/delete/archive, custom icons and colors, reordering, and merging duplicates — not just a fixed dropdown.

## Scope for this phase

**In:** `categories` table (global/shared, not per-user), seeded with the existing 6 defaults; full CRUD repository; "Manage Categories" screen reached from Budget via a gear icon — add/edit form (name, icon picker, color picker), drag-and-drop reorder, archive/unarchive, delete with forced reassignment when bills are attached, merge two categories into one; Budget page sources category identity (name/icon/color/order/archived) from the live table.

**Out (backlog, handled in the Bills spec that follows):** `Bill.category` → `Bill.categoryId` migration itself, Bills table/repository, Bills add/edit/delete UI. Budget's `limit`/`spent` numbers stay mock/local for now — this phase only makes category *identity* real, not budget tracking math (that's a separate future "real Budget backend" phase). Accounts and Reminders untouched.

## Data model

New migration `supabase/migrations/0004_categories.sql`:

```sql
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

Global/shared, not per-user: unlike receipts, this app has a single admin login and categories aren't personal data, so RLS just gates on `authenticated` rather than `auth.uid()` ownership.

`lib/categories-types.ts`:

```typescript
export type CategoryIconKey =
  | 'building-2' | 'shopping-cart' | 'car' | 'film' | 'zap' | 'shopping-bag'
  | 'home' | 'heart' | 'plane' | 'coffee' | 'gift' | 'book'
  | 'dumbbell' | 'smartphone' | 'wifi' | 'credit-card' | 'piggy-bank' | 'wallet'
  | 'utensils' | 'bus' | 'fuel' | 'graduation-cap' | 'stethoscope' | 'paw-print';

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

## Icon & color

`lib/category-icons.ts` — `ICON_MAP: Record<CategoryIconKey, LucideIcon>` mapping the 24 curated keys above to their lucide-react components. The icon picker renders this map as a grid; nothing free-text.

`lib/category-colors.ts` — extends the existing 6-slot palette to 12 fixed Tailwind classes, exporting `STROKE_COLOR_CLASS`, `DOT_COLOR_CLASS`, `BAR_COLOR_CLASS` keyed `1-12`. `components/budget/BudgetDonutChart.tsx` and `components/budget/BudgetCategoryCard.tsx` switch their imports from their current inline maps to this shared file (their existing 1-6 entries carry over unchanged; slots 7-12 are new).

## Repository

`lib/categories-repository.ts`, same plain-async-function style as `lib/receipts-repository.ts` (fresh `createClient()` per call, manual snake_case↔camelCase row mapping via `rowToCategory()`):

- `listCategories(): Promise<Category[]>` — ordered by `sort_order`
- `createCategory(input: { name, icon, colorSlot }): Promise<Category>` — appends at end of sort order
- `updateCategory(id, patch: Partial<Pick<Category, 'name' | 'icon' | 'colorSlot'>>): Promise<Category>`
- `archiveCategory(id): Promise<void>` / `unarchiveCategory(id): Promise<void>`
- `deleteCategory(id, reassignToId?: string): Promise<void>` — if any bill references `id`, caller must supply `reassignToId`; repository reassigns then deletes in one transaction (Postgres function or two sequential calls wrapped with a check — see Error handling)
- `mergeCategories(sourceId, targetId): Promise<void>` — reassigns all bills from source to target, then deletes source
- `reorderCategories(orderedIds: string[]): Promise<void>` — bulk-updates `sort_order` to match array index

Note: `deleteCategory`/`mergeCategories`'s "reassign bills" step is inert until the Bills spec lands (no `bills` table yet) — implemented now against a `bills` table reference that will exist by the time this ships, since Bills is the very next spec. If Bills isn't done yet when this is implemented, that reassignment step is a no-op guarded by a table-existence check, not a hard dependency.

## UI

`app/(shell)/budget/categories/page.tsx` — new screen, linked from a gear icon in the Budget page header.

- `components/categories/CategoryList.tsx` — drag-and-drop reorderable list (new dependency: `@dnd-kit/core` + `@dnd-kit/sortable`, not currently installed). Each row: icon, color dot, name, "Archived" badge when applicable, edit/archive-unarchive/delete actions. Archived categories render in a separate, collapsed section below active ones.
- `components/categories/CategoryForm.tsx` — add/edit modal: name text input, icon grid picker, color swatch picker (12 swatches).
- `components/categories/DeleteCategoryDialog.tsx` — checks bill count for the category first; if > 0, shows a "reassign to" dropdown (other active categories) that must be filled before the delete button enables; if 0, plain confirm.
- `components/categories/MergeCategoriesDialog.tsx` — two dropdowns (source, target) + confirm; disabled until both selected and distinct.
- `lib/use-categories.ts` — hook: `{ categories, activeCategories, archivedCategories, loading, error, refresh, create, update, archive, unarchive, remove, merge, reorder }`, mirroring receipts' data-fetching shape.

Budget page (`app/(shell)/budget/page.tsx`, `lib/use-budget.ts`): `use-budget` fetches categories via `use-categories` instead of importing static `budgetCategories`. The mock seed (`lib/budget-data.ts`) currently keys `limit`/`spent` by string ids (`'housing'`, `'groceries'`, …) that won't match the real table's uuids, so the seed is re-keyed by **category name** instead (`Record<string, { limit: number; spent: number }>`) and `use-budget` looks up each live category's `limit`/`spent` by `name`, defaulting to `{ limit: 0, spent: 0 }` for any category not in the seed (i.e. any custom category the user creates gets a fresh $0/$0 budget row — expected, since real budget tracking isn't built yet). Renamed/reordered/archived categories reflect immediately; archived categories are excluded from the Budget view entirely (not just visually deprioritized); a category rename means its mock limit/spent lookup falls through to the $0 default until the real Budget backend phase, which is an acceptable, called-out limitation of this phase.

## Error handling

Repository functions throw on Supabase errors; `use-categories` catches and sets an `error` string, surfaced as inline text near the failed action (same convention as receipts). Delete/merge/archive are all blocking — the dialog stays open with an error message on failure, no optimistic UI/rollback dance since these are low-frequency, deliberate actions.

## Testing

TDD, inline execution, Vitest + RTL, matching existing `lib/*.test.ts` / `components/**/*.test.tsx` coverage:

- `lib/categories-repository.test.ts` — each function against a mocked Supabase client (success + error paths)
- `lib/category-colors.test.ts`, `lib/category-icons.test.ts` — map completeness (every `CategoryIconKey` has an entry, slots 1-12 all defined)
- `components/categories/DeleteCategoryDialog.test.tsx` — delete-button disabled until reassignment target chosen when bill count > 0; enabled immediately when 0
- `components/categories/MergeCategoriesDialog.test.tsx` — confirm disabled until source ≠ target both chosen
- `lib/use-budget.test.ts` — updated to source categories from the (mocked) categories hook instead of the static array

## Out of scope (backlog)

Bills table/migration/repository/UI (next spec), Accounts, Reminders, real Budget limit/spent persistence, per-category budget history, category icons/colors beyond the curated sets, undo for delete/merge.
