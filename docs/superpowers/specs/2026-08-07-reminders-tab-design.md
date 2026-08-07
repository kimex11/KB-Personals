# Reminders Tab Expansion — Design Spec

Third phase of `update1.md`'s roadmap (Home dashboard, then Bills tab, now Reminders). Self-brainstormed, self-approved per the user's standing overnight-autonomy instruction. Scope bounded the same way as every prior phase.

## Context

Reminders tab is currently `PlaceholderScreen`. `update1.md` asks generically for "reminders" improvements under its "Other Tabs" section (goal tracking, progress indicators, scheduled items). Research (2026 reminder apps — Todoist, TickTick, Apple Reminders, Things3): complete-toggle as the primary interaction, priority levels, snooze (push due date forward), tags/categories, list sorting.

Sources:
- [Reminder Apps: We tested the Best 12 in 2026](https://blog.saner.ai/best-reminder-apps/)
- [Best To-Do List Apps of 2026: 9 Tested Ranked](https://nathanojaokomo.com/blog/best-to-do-list-apps)

## Scope for this phase

**In:** reminder list with a complete/undo toggle (same interaction pattern as Bills' Mark-as-Paid, for consistency), priority levels (High/Medium/Low, color-coded), category tags, a Snooze action (pushes due date +1 day, local state only), search + priority filter + sort (by date or priority), a summary strip (today's count, overdue count).

**Out (backlog):** recurring reminders, push notifications, custom snooze intervals, sub-tasks, calendar view (Reminders doesn't need its own calendar — Bills already has one, and reminders already appear on it via the existing `CalendarEvent` type), add/edit forms, backend persistence.

## Data model

New `lib/reminders-types.ts`:

```typescript
export type Priority = 'high' | 'medium' | 'low';

export interface Reminder {
  id: string;
  title: string;
  category: string;
  dueDate: string; // ISO 'yyyy-MM-dd'
  priority: Priority;
  completed: boolean;
}
```

`lib/reminders-data.ts`: ~8 mock reminders, mix of priorities/categories/completed states, `dayOffset`-seeded like every other mock dataset in this project.

`lib/reminders-selectors.ts`: `isOverdue(reminder, referenceDate?)`, `filterReminders(reminders, query, priorityFilter, referenceDate?)`, `sortReminders(reminders, sortBy: 'dueDate' | 'priority')`, `remindersSummary(reminders, referenceDate?): { dueTodayCount, overdueCount }`.

## Components (`components/reminders/`)

- `PriorityBadge.tsx` — colored pill (High = status-critical, Medium = status-warning, Low = neutral gray) — same visual language as `BillStatusBadge`
- `ReminderRow.tsx` — complete-toggle (checkbox, same visual as `BillRow`'s paid-toggle but a plain checkmark not currency-flavored), title (strikethrough when completed), category tag, relative due date, priority badge, Snooze button
- `RemindersSummary.tsx` — today's count + overdue count, colorful (matches `BillsSummary`'s visual weight)
- `RemindersFilterBar.tsx` — search + priority filter chips (All/High/Medium/Low) + sort toggle (Due Date/Priority)
- `RemindersListView.tsx` — composes the above, local filter/sort/search/snooze/complete state

No new design tokens needed — reuses `status-critical`/`status-warning` from the Bills phase plus existing neutrals.

## Page composition

`app/(shell)/reminders/page.tsx` replaces `PlaceholderScreen` with `RemindersListView`, owning `completedOverrides`/`snoozedDates` state (same additive-override pattern as Bills' `paidOverrides` — session-only, mock data unchanged at the source).

## Testing

TDD, inline execution, Vitest + RTL.

## Out of scope (backlog)

Recurring reminders, push notifications, custom snooze intervals, sub-tasks, add/edit forms, backend persistence. Budget and Receipts tab expansions remain untouched.
