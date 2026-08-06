# Financial Tracker — Phase 1: App Shell & Home (Calendar) Design

Date: 2026-08-06
Status: Approved (pending final spec review)

## Scope

This is Phase 1 of the Financial Tracker app, sourced from `appshell.md`. It covers only:

- The app shell (navigation, header, mobile-first layout)
- The Home screen (calendar-based dashboard)
- Placeholder screens for the other four tabs

Out of scope for this phase (future specs): Budget, Bills, Reminders, Receipts full screens; backend/API; auth; push notifications/sound; receipt camera capture and OCR extraction; add/edit flows for events.

## Goals

- Premium, production-ready feel — not "AI-generated default"
- Calendar-first home screen where bills/reminders/tasks are recognizable at a glance
- Frontend-only, but structured so a real backend can be swapped in later without touching UI components
- Brand identity (KB Personals gold/black logo) present but understated

## Architecture

- Next.js (App Router) + TypeScript
- Mobile-first: content constrained to a phone-width shell, centered with a neutral gutter on wider viewports
- Tailwind CSS + shadcn/ui as component base, every design token (color, radius, shadow, font) overridden via the Tailwind theme — no stock shadcn look
- Framer Motion for transitions/animations

```
app/
  layout.tsx           root layout, shell chrome
  page.tsx              Home (calendar)
  budget/page.tsx        placeholder
  bills/page.tsx          placeholder
  reminders/page.tsx      placeholder
  receipts/page.tsx       placeholder
components/
  shell/                TabBar, Header
  calendar/              MonthGrid, DayCell, DayDetailPanel, EventCard
  shared/                EmptyState, PlaceholderScreen
lib/
  types.ts               CalendarEvent, EventType
  mock-data.ts            typed sample month of events
  use-calendar-events.ts   hook wrapping mock data (swap point for future API)
```

## Navigation & App Shell

- Bottom tab bar, fixed, safe-area aware (respects notch/home-indicator insets)
- 5 tabs: Home, Budget, Bills, Reminders, Receipts — icon + label
- Active tab: gold accent (fill/underline) + subtle press animation on tap
- Header: small dark chip with KB monogram (not full logo lockup) + current screen title
- Budget/Bills/Reminders/Receipts render a shared `PlaceholderScreen` component (icon + "Coming soon" message), using the same shell chrome, so the nav feels complete even though only Home has real content

## Home Screen (Calendar)

- **Month grid** (7 columns × up to 6 rows), current day highlighted with a gold ring
- Days with events show a small badge/dot; color coded by type (bill = gold, reminder = neutral gray, task = outline)
- Month header with prev/next arrows; swipe gesture also changes month
- Tapping a day expands a **detail panel** below the grid listing that day's items as cards (title, time, amount if a bill, icon by type)
- Empty day selected → friendly empty state ("Nothing scheduled")
- A "+" affordance opens a stub bottom sheet ("Coming soon") — no add/edit logic this phase

## Visual Design System

- **Background:** near-white (`#FAFAFA`), not stark white
- **Accent gold:** desaturated warm gold, drawn from the logo — used sparingly (active tab, day-highlight ring, badges, key numbers). No large gold fills.
- **Dark chip:** near-black (`#0B0B0C`) for the header logo chip; tab bar may also use this for grounding contrast against the light background
- **Typography:** one serif for the wordmark/large numeric emphasis (echoes logo), one clean sans (Inter or similar) for body/labels/grid. Generous line-height.
- **Spacing:** 4px base scale; card padding 16–24px; minimum 44px touch targets
- **Surfaces:** large radii (12–16px), soft low-contrast 1px borders preferred over heavy drop shadows

## Data Layer

```ts
type EventType = 'bill' | 'reminder' | 'task';

interface CalendarEvent {
  id: string;
  type: EventType;
  title: string;
  date: string;      // ISO date
  time?: string;
  amount?: number;    // present for bills
}
```

`lib/mock-data.ts` exports a realistic sample month of `CalendarEvent[]`. `useCalendarEvents()` reads from mock data now; later this hook's internals swap to a real fetch/query without any component changes.

## Motion

- Tab switch: quick fade/slide
- Day selection: detail panel expands with easing; selected day scales slightly
- List items: staggered fade-in on mount
- Implemented with Framer Motion

## Testing

- Manual verification via dev server + browser tool: navigate all 5 tabs, confirm placeholder screens render, confirm calendar renders current month with sample events, confirm day-tap expands detail panel correctly, confirm empty-day state, confirm responsive behavior at mobile viewport width
- Automated test suite: Vitest + React Testing Library, with one test file per component/module (15 test files) covering date utilities, mock data, the `useCalendarEvents` hook, and all calendar/shell/shared components

## Open Questions / Future Phases

- Budget, Bills, Reminders, Receipts full screens — separate specs
- Backend/API design, auth, persistence
- Push notification + sound implementation
- Camera capture + OCR receipt extraction
- Add/edit flows for calendar events
