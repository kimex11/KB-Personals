# Bills Tab Expansion — Design Spec

Second phase of `update1.md`'s roadmap (first was the Home dashboard). Self-brainstormed per user's standing instruction to always proceed with the recommended option without waiting for review on this pass. Scope bounded deliberately — `update1.md` lists a dozen-plus possible Bills features; this phase ships the highest-value slice and backlogs the rest, same discipline as every prior phase.

## Context

Bills tab is currently `PlaceholderScreen` ("Coming soon"). `update1.md` asks for: recurring bills, auto next-due-date, statuses (paid/unpaid/upcoming/overdue/partial), payment history, variable amounts, categories, custom reminders, calendar integration, subscription tracking, monthly totals, forecasting, attachments, notes, search/filter/sort, duplicate detection, quick mark-as-paid.

Research (2026 bill-management apps): status-sorted lists (overdue / due-soon / upcoming), recurring billing periods as a first-class badge, one-tap mark-as-paid, calendar view for the full cycle.

Sources:
- [10 Best Bill Management Apps & Tools in 2026](https://useorigin.com/resources/blog/10-best-bill-management-apps-tools-in-2026-u-s-guide)
- [Bills Manager - Finance App](https://mwm.ai/apps/bills-manager/834370671)
- [Banking App UX: Top 10 Best Practices](https://medium.com/@adam.fard/banking-app-ux-top-10-best-practices-adc54ca962ea)

## Scope for this phase

**In:** status-grouped bill list (Overdue / Due Soon / Upcoming / Paid), recurrence badge (presentational), category, search, status filter chips, sort by due date/amount, monthly bill total summary, functional Mark-as-Paid (real local state this time, not a stub — Bills is the dedicated screen for it), calendar view toggle that relocates the existing `MonthGrid`/`DayDetailPanel` here (the "undecided" backlog item from the Home dashboard phase, now decided).

**Out (backlog):** payment history log, attachments/receipts, custom per-bill reminder schedules, duplicate detection, forecasting math, subscription-specific tracking beyond the recurrence badge, partial-payment amounts, add/edit bill forms (still mock data), backend persistence.

## Data model

New `lib/bills-types.ts`:

```typescript
export type RecurrenceInterval = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | null;

export interface Bill {
  id: string;
  title: string;
  category: string;
  amount: number;
  dueDate: string; // ISO 'yyyy-MM-dd'
  recurrence: RecurrenceInterval;
  paid: boolean;
}

export type BillStatus = 'paid' | 'overdue' | 'due-soon' | 'upcoming';
```

Status is **derived, not stored** — `paid` flag plus `dueDate` vs. a reference date determines `overdue` / `due-soon` (within 3 days) / `upcoming`. Same pattern as the dashboard's pure, referenceDate-parameterized selectors, for the same testability reason.

`lib/bills-data.ts`: ~9 mock bills, mix of recurring/one-off, mix of paid/unpaid, seeded relative to a base date (same day-offset technique as `mock-data.ts`).

Calendar view keeps using the **existing** `useCalendarEvents()`/`CalendarEvent` data — it is not migrated to the new `Bill` type. The calendar's job is showing all event types (bill/reminder/task) on a month grid; that behavior is preserved exactly as built in Phase 1, just relocated into this tab behind a view toggle.

## Components (`components/bills/`)

- `BillStatusBadge.tsx` — colored pill per status (new tokens below)
- `BillRow.tsx` — icon, title, category, recurrence badge, relative due date, amount, status badge, Mark as Paid toggle (checkbox-style, immediate visual flip, no confirmation step)
- `BillsSummary.tsx` — this month's total billed, overdue count, due-soon count — visually prominent, colorful (this is the "add life/color" surface for this phase)
- `BillsFilterBar.tsx` — search input (title/category) + status filter chips (All/Overdue/Due Soon/Upcoming/Paid) + sort toggle (Due Date/Amount)
- `BillsListView.tsx` — composes the above, groups filtered/sorted bills by status section

## New design tokens

Add to `app/globals.css`'s `@theme inline` block, alongside the existing `--color-status-critical`:

```css
--color-status-success: #1E8E5A;
--color-status-warning: #D9932B;
```

`status-critical` (existing) = Overdue, `status-warning` (new) = Due Soon, `status-success` (new) = Paid, neutral gray = Upcoming.

## Page composition

`app/(shell)/bills/page.tsx`: local state for `view: 'list' | 'calendar'` (segmented control at top) and a `paidOverrides: Set<string>` for bills toggled via Mark as Paid this session (merged with each mock bill's own `paid` flag — toggling is additive/session-only, not persisted past reload, consistent with mock-data-only scope). List view renders `BillsListView`; calendar view renders the existing `MonthGrid` + `DayDetailPanel` exactly as `app/(shell)/page.tsx` did in Phase 1, reading from `useCalendarEvents()`.

## Testing

TDD, inline execution, Vitest + RTL — same pattern as the Home dashboard phase.

## Out of scope (backlog)

Payment history, attachments, custom reminders, duplicate detection, forecasting, add/edit forms, real backend persistence, partial payments. Budget/Reminders/Receipts tab expansions remain untouched.
