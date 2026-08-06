# Financial Tracker — Budget Screen Design

Date: 2026-08-07
Status: Approved (pending final spec review)

## Scope

Build out the Budget tab (`app/(shell)/budget/page.tsx`), currently a "Coming soon" placeholder, into a real category-budgeting screen: monthly summary, spend-by-category donut chart, and per-category progress. Frontend only, backed by mock data — same pattern established for the calendar Home screen.

Out of scope: real transactions/bank sync, editing budget limits, adding/removing categories, multi-month history or navigation, 50/30/20 or envelope budgeting frameworks, backend/API.

## Research Basis

Reviewed current (2026) budgeting-app conventions (Monarch Money, YNAB, Copilot) and UX guidance. Consistent pattern across all of them: a monthly overview (budgeted/spent/remaining), category-level budgets shown as progress bars, and a chart giving an at-a-glance spend breakdown. Flat per-category budgets (vs. envelope or 50/30/20 frameworks) are the most common and lowest-friction starting point. Sources: Monarch's budgeting feature page, NerdWallet's 2026 budget app roundup, Appthetics' budgeting-app UX patterns article.

## Data Model

```ts
interface BudgetCategory {
  id: string;
  name: string;
  icon: LucideIcon;
  colorSlot: 1 | 2 | 3 | 4 | 5 | 6;  // fixed categorical color mapping, never reassigned
  limit: number;                     // monthly budget limit
  spent: number;                     // mock "spent so far this month"
}
```

Six mock categories, each with a realistic limit/spent pair; exactly one is deliberately over its limit so the overspent visual state has something real to render:

| Category | Icon | Slot | Limit | Spent |
|---|---|---|---|---|
| Housing | Building2 | 1 (blue) | 1450 | 1450 |
| Groceries | ShoppingCart | 2 (orange) | 500 | 468 |
| Transport | Car | 3 (aqua) | 200 | 145 |
| Entertainment | Film | 4 (yellow) | 120 | 138 (over) |
| Utilities | Zap | 5 (magenta) | 220 | 190 |
| Shopping | ShoppingBag | 6 (green) | 300 | 95 |

Lives in `lib/budget-data.ts`. `lib/use-budget.ts` wraps it (categories list + computed totals), mirroring `useCalendarEvents()` — the intended swap point for a real backend later.

## Visual Design

**Categorical palette (spend-by-category donut + progress bars):** six fixed hues, one per category slot above, added as Tailwind v4 theme tokens in `app/globals.css`:

```css
--color-budget-1: #2a78d6;  /* blue */
--color-budget-2: #eb6834;  /* orange */
--color-budget-3: #1baf7a;  /* aqua */
--color-budget-4: #eda100;  /* yellow */
--color-budget-5: #e87ba4;  /* magenta */
--color-budget-6: #008300;  /* green */
```

Validated via the dataviz skill's `validate_palette.js` against the app's `#FAFAFA` surface: lightness band, chroma floor, CVD separation, and normal-vision floor all PASS. Three slots (aqua, yellow, magenta) fall under 3:1 contrast against the surface — the skill's "relief rule" applies, satisfied by always pairing color with a visible name label (legend rows, category cards) rather than ever using color alone to convey identity.

**Overspent status color:** a category over its limit shows a status-critical red (`--color-status-critical: #d03b3b`), distinct from all six categorical hues, paired with an "Over budget" text label — never color alone, per the dataviz skill's status-color rule. This red is reserved for the overspent state only, never reused as a 7th category color.

**Colors are assigned by category identity, fixed in the mock data, never cycled or re-derived from render order.**

## Screen Layout

Top to bottom:

1. **Summary row** — three stat tiles: Budgeted, Spent, Remaining (this month's totals, computed from the category list)
2. **Donut chart** — SVG, one slice per category at its `spent` proportion of total spend, using the six categorical tokens above; a legend below listing each category's swatch, name, and spent amount (satisfies the contrast-relief requirement — never color-only)
3. **Category list** — one card per category: icon, name, progress bar (`spent / limit`, filled with that category's color, or status-red + "Over budget" if `spent > limit`), and a `$spent of $limit` line

Reuses the app's existing card/surface conventions (rounded corners, soft borders) and the `#FAFAFA` background — no new page-level chrome, this slots into the existing `AppShell` route.

## Architecture

```
app/(shell)/budget/page.tsx          composes summary + chart + category list (replaces PlaceholderScreen usage)
components/budget/
  BudgetSummary.tsx                   3-stat row
  BudgetDonutChart.tsx                 SVG donut + legend
  BudgetCategoryCard.tsx               one category card with progress bar
lib/
  budget-types.ts                      BudgetCategory type
  budget-data.ts                       mock categories
  use-budget.ts                        hook: categories + computed totals (budgeted/spent/remaining)
```

## Testing

- Vitest + RTL, one test file per component/module, matching the existing pattern:
  - `use-budget.ts`: totals (budgeted/spent/remaining) computed correctly from mock categories
  - `BudgetSummary`: renders the three totals correctly
  - `BudgetDonutChart`: renders one slice + one legend row per category, legend shows name + amount (not color alone)
  - `BudgetCategoryCard`: progress bar width reflects `spent/limit`; renders the overspent status-red + "Over budget" label when `spent > limit`, and the category's own color when under
  - `app/(shell)/budget/page.tsx`: composes all three sections
- Manual verification via dev server + browser tool: visit `/budget`, confirm the summary totals, donut chart renders with legible legend, category cards show correct progress and the one overspent category renders in status-red with its label — confirm this at mobile viewport width

## Open Questions / Future Phases

- Editing budget limits, adding/removing categories
- Real transaction data / bank sync
- Multi-month navigation and history
- Alternative budgeting frameworks (envelope, 50/30/20)
- Backend/API for persisting budgets
