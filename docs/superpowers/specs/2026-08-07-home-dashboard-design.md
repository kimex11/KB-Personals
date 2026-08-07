# Home Dashboard — Design Spec

Follow-up to the real-Supabase-auth phase. First feature phase of `update1.md`'s roadmap ("evolve the app into a polished personal finance command center"). Scope: rebuild the Home tab from a calendar into an information-dense dashboard. All other tabs (Bills, Reminders, Receipts) and their expansions from `update1.md` are explicitly out of scope for this phase.

## Context

Home is currently a month-grid calendar (`MonthGrid` + `DayDetailPanel`) reading mock bill/reminder/task events from `lib/mock-data.ts`. Budget tab is a real category-budgeting screen (`BudgetSummary`, `BudgetDonutChart`, `BudgetCategoryCard`) reading mock data from `lib/budget-data.ts`. Auth is real (Supabase); all financial data (bills, transactions, goals, budget) is still mock — no backend for any of it yet. This phase stays mock-data-only, consistent with the project's phased build order.

Researched against 2026 Monarch Money / YNAB / Copilot conventions: none of them put every widget on one flat screen — they prioritize by urgency (overdue/due-soon first) and keep the rest as a single scannable scroll, not a dense grid. This design follows that pattern.

## Layout: stacked priority panels

Single vertical scroll, most urgent information first. Panels, top to bottom:

### 1. Alerts banner
Renders **only when overdue items exist** — no "all clear" banner clutter. Red/status-accent card listing overdue bills (title, days overdue, amount). Derived by filtering mock bill events with a due date before today.

### 2. This Week's Bills
Bills due today through the next 7 days, sorted by date ascending. Each row: title, due date (relative — "Today", "Tomorrow", "Fri"), amount, a "Mark as Paid" button (stub — see Quick Actions/stub behavior below). Empty state: `EmptyState` component, "No bills due this week."

Data: filter `mock-data.ts` events where `type === 'bill'` and date falls in `[today, today+7]`.

### 3. Spending Snapshot
This month's budgeted / spent / remaining totals, summed from `budget-data.ts` categories (same numbers Budget tab already computes). Compact presentation — a single progress bar or ring, not the full donut+legend (that stays Budget tab's job, avoid duplicating it here). Links to Budget tab for detail.

### 4. Recent Transactions
Last 4-5 mock transactions: title, category, amount, relative date ("2 days ago"). New mock list (see Data section). Empty state not expected to trigger (mock list always populated) but component should handle empty gracefully.

### 5. Reminders
Next 2-3 upcoming `type === 'reminder'` events from `mock-data.ts`, sorted by date. Empty state: `EmptyState`, "No upcoming reminders."

### 6. Goal Progress
One mock savings goal ("Emergency Fund"): saved amount, target amount, progress bar. Single goal only — no goals list/CRUD this phase.

### 7. Quick Actions
Row of icon buttons: Add Bill, Add Expense, Add Reminder, Add Receipt, Add Transaction. Each opens a bottom sheet with "Coming soon" — same stub pattern as the existing Home `+` button (`Sheet`/`SheetContent`, `data-testid="add-event-sheet"`-style). No navigation, no real forms.

"Mark as Paid" (panel 2) is also a stub in this phase: tapping shows a toast/inline "Coming soon" state rather than mutating mock data, since there's no persistence layer yet and partial bill-state UI is explicitly scoped to the future Bills-tab expansion in `update1.md`.

## Data

- `lib/dashboard-data.ts` (new): typed mock transactions list + single mock goal, following the existing seed-array pattern used by `mock-data.ts` (`EVENT_SEEDS` → `generateMockEvents`). Transactions use day-offsets from a base date the same way existing mock events do, so "recent" stays relative to today.
- Bills (panels 1, 2) and Reminders (panel 5): derived from existing `lib/mock-data.ts` via `useCalendarEvents()` — no new bill/reminder data source, just new filtering/selector logic (e.g. a `getBillsDueWithinDays` or equivalent helper alongside `getEventsForDate`).
- Spending (panel 3): derived from existing `lib/budget-data.ts` categories, summed.

## Components

New, under `components/dashboard/`:
- `AlertsBanner.tsx`
- `WeeklyBillsPanel.tsx`
- `SpendingSnapshot.tsx`
- `RecentTransactionsPanel.tsx`
- `RemindersPanel.tsx`
- `GoalProgressPanel.tsx`
- `QuickActionsRow.tsx`

Each panel is a self-contained unit: takes its slice of data as props, renders its own empty/populated states, no cross-panel coupling. `app/(shell)/page.tsx` becomes a thin composition of these panels plus the existing Quick Actions sheet pattern.

## Calendar removal

`MonthGrid` and `DayDetailPanel` are **not deleted** — they stay as-is with their existing tests, just no longer rendered from `app/(shell)/page.tsx`. Where the calendar view resurfaces (Bills tab, a dedicated route, etc.) is explicitly deferred — not decided in this phase. No placeholder route is created for it. This is a known gap, tracked as backlog below, not a bug.

## Styling

Reuses existing design tokens (gold `#B08D57`, ink `#0B0B0C`, Fraunces/Inter, near-white `#FAFAFA`) and existing primitives (`Button`, `Sheet`, card patterns established by the Budget screen components). No new visual language introduced.

## Testing

TDD, executed inline (not subagent-driven, matching the Budget screen phase): failing test per panel component first, then implementation. Existing Vitest + React Testing Library setup. Playwright pass at the end for in-browser visual/interaction verification (mobile width primarily, matching prior phases' verification approach).

## Out of scope (backlog)

- Bills tab expansion (recurring bills, statuses, payment history, etc. — `update1.md`'s Bills section)
- Any other tab's expansion (Budget editing, Reminders, Receipts)
- Real backend for bills/transactions/goals — still mock this phase
- Calendar view's new home (Bills tab? dedicated route? — undecided)
- Functional Quick Actions / "Mark as Paid" (all stubs this phase)
- Goals as a real feature (list, CRUD, multiple goals)
