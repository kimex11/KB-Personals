# Reminders Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans.

**Goal:** Build out Reminders tab from placeholder into a priority-aware, searchable/filterable/sortable reminder list with complete-toggle and snooze actions.

**Architecture:** Mirrors the Bills tab's structure exactly — `Reminder` type + pure selectors in `lib/`, presentational components in `components/reminders/`, composed in `app/(shell)/reminders/page.tsx` with session-only override state.

**Tech Stack:** Next.js, TypeScript, Tailwind v4, date-fns, Vitest + RTL.

## Global Constraints

- Mock data only, `dayOffset` seed pattern.
- Currency n/a (reminders have no amount). Reuse existing `status-critical`/`status-warning` tokens for priority; no new tokens.
- Reuse `EmptyState`. TDD: failing test before implementation. `npm test` to verify.

---

### Task 1: `Reminder` type, mock data, selectors
**Files:** `lib/reminders-types.ts`, `lib/reminders-data.ts` (+test), `lib/reminders-selectors.ts` (+test)
**Interfaces:** `Reminder { id, title, category, dueDate, priority, completed }`, `Priority = 'high'|'medium'|'low'`, `generateMockReminders(baseDate?): Reminder[]`, `mockReminders`, `isOverdue(reminder, referenceDate?): boolean`, `filterReminders(reminders, query, priorityFilter, referenceDate?): Reminder[]`, `sortReminders(reminders, sortBy: 'dueDate'|'priority'): Reminder[]`, `remindersSummary(reminders, referenceDate?): { dueTodayCount: number; overdueCount: number }`

### Task 2: `PriorityBadge`, `ReminderRow`
**Files:** `components/reminders/PriorityBadge.tsx`, `components/reminders/ReminderRow.tsx` (+tests)
**Interfaces:** `PriorityBadge({ priority: Priority })`, `ReminderRow({ reminder: Reminder, onToggleComplete: (id) => void, onSnooze: (id) => void, referenceDate?: Date })` — `data-testid="reminder-row"`, `data-testid="reminder-complete-toggle"`, `data-testid="reminder-snooze-button"`

### Task 3: `RemindersSummary`, `RemindersFilterBar`
**Files:** `components/reminders/RemindersSummary.tsx`, `components/reminders/RemindersFilterBar.tsx` (+tests)
**Interfaces:** `RemindersSummary({ dueTodayCount, overdueCount })`, `RemindersFilterBar({ query, onQueryChange, priorityFilter, onPriorityFilterChange, sortBy, onSortByChange })`

### Task 4: `RemindersListView` composition
**Files:** `components/reminders/RemindersListView.tsx` (+test)
**Interfaces:** `RemindersListView({ reminders: Reminder[], onToggleComplete, onSnooze, referenceDate? })`

### Task 5: Wire `app/(shell)/reminders/page.tsx`
**Files:** Modify `app/(shell)/reminders/page.tsx`, `app/(shell)/reminders/page.test.tsx`
**Interfaces:** `RemindersPage()` — owns `completedOverrides: Set<string>`, `snoozedDates: Map<string, string>` state.

### Task 6: Full verification
`npm test`, `npx tsc --noEmit`, `npx eslint .`, `npm run build`.
