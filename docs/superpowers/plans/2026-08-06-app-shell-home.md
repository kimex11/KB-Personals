# Financial Tracker Phase 1 (App Shell & Home) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Next.js app shell (5-tab bottom nav, header) and a fully working calendar-based Home screen, backed by typed mock data, per `docs/superpowers/specs/2026-08-06-app-shell-home-design.md`.

**Architecture:** Next.js App Router + TypeScript, Tailwind CSS + shadcn/ui (re-themed), Framer Motion for transitions, date-fns for date math. Mock data lives behind a `useCalendarEvents()` hook so a real backend can replace it later without touching components.

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, date-fns, lucide-react, Vitest + React Testing Library.

## Global Constraints

- Frontend only — no backend, no auth, no persistence this phase.
- No hardcoded values duplicated across files — nav items, colors, and fonts each have one source of truth.
- Mobile-first: content constrained to a phone-width shell (`max-w-md`), centered.
- Minimum 44px (`h-11 w-11` / equivalent) touch targets.
- Background near-white (`#FAFAFA`), not stark white.
- Gold accent (`#B08D57`) used sparingly — active states, rings, badges, key numbers — never large fills.
- Dark chip (`#0B0B0C`) reserved for the header logo chip.
- Serif font for wordmark/large numeric emphasis, sans font for body/labels/grid.
- Add/edit flows are out of scope — the "+" button opens a "Coming soon" stub only.

---

### Task 1: Project Scaffold & Testing Tooling

**Files:**
- Create: full Next.js project (via CLI) — `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css` (Tailwind v4 — no `tailwind.config.ts`; theme lives in `app/globals.css`'s `@theme inline` block)
- Create: `components/ui/button.tsx`, `components/ui/sheet.tsx` (via shadcn CLI)
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Modify: `package.json` (add `test` script)

**Interfaces:**
- Produces: a working `npm run dev` server, a working `npm test` (Vitest) command, shadcn `Button`/`Sheet` components at `@/components/ui/button` and `@/components/ui/sheet`.

This task is pure scaffolding with no application behavior yet, so it does not follow the red/green test cycle used in later tasks — verification here is "the tools run", not "a test passes".

- [ ] **Step 1: Scaffold the Next.js app**

Run from the project root (`/Users/kendrickynanflores/Documents/Personal/Claude/Financial Tracker`):

```bash
npx create-next-app@latest . --typescript --eslint --tailwind --app --no-src-dir --import-alias "@/*" --no-turbopack --use-npm
```

If prompted interactively, answer: TypeScript = Yes, ESLint = Yes, Tailwind = Yes, `src/` directory = No, App Router = Yes, import alias = `@/*`.

- [ ] **Step 2: Initialize shadcn/ui and add the components this phase needs**

```bash
npx shadcn@latest init -d
npx shadcn@latest add button sheet
```

This creates `components/ui/button.tsx` and `components/ui/sheet.tsx`.

- [ ] **Step 3: Install remaining dependencies**

```bash
npm install date-fns framer-motion lucide-react
npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 4: Create the Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
});
```

- [ ] **Step 5: Create the Vitest setup file**

Create `vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';

if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList;
  }

  if (!('ResizeObserver' in window)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    // @ts-expect-error test polyfill
    window.ResizeObserver = ResizeObserverStub;
  }
}
```

`matchMedia` and `ResizeObserver` are stubbed because shadcn/ui's Radix-based `Sheet` component (used in Task 10) probes for them and jsdom doesn't provide them.

- [ ] **Step 6: Add the test script**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run"
```

- [ ] **Step 7: Verify the dev server boots**

```bash
npm run dev
```

Expected: server starts on `http://localhost:3000` without errors. Stop it with Ctrl+C.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Tailwind, shadcn/ui, and Vitest"
```

---

### Task 2: Design Tokens (Colors, Fonts)

**Files:**
- Modify: `app/globals.css` (Tailwind v4 theme — no `tailwind.config.ts` exists in this project; theme tokens are CSS custom properties inside the existing `@theme inline { ... }` block)
- Modify: `app/layout.tsx`
- Test: `globals-theme.test.ts`

**Interfaces:**
- Produces: Tailwind utility classes `bg-gold`/`text-gold` (`#B08D57`) and `bg-ink`/`text-ink` (`#0B0B0C`) via `--color-gold`/`--color-ink` theme tokens; `font-serif` utility backed by `--font-serif` (set at runtime by next/font's `variable` option on the Fraunces loader). `--font-sans` already exists in the generated file, backed by the Inter loader.

- [ ] **Step 1: Write the failing test**

Create `globals-theme.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(__dirname, 'app/globals.css'), 'utf-8');

describe('design tokens in app/globals.css', () => {
  it('defines the gold accent and ink colors in the Tailwind v4 theme', () => {
    expect(css).toMatch(/--color-gold:\s*#B08D57;/);
    expect(css).toMatch(/--color-ink:\s*#0B0B0C;/);
  });

  it('maps a serif font family token backed by the next/font CSS variable', () => {
    expect(css).toMatch(/--font-serif:\s*var\(--font-serif\);/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run globals-theme.test.ts
```

Expected: FAIL — `app/globals.css` doesn't yet declare `--color-gold`, `--color-ink`, or `--font-serif`.

- [ ] **Step 3: Extend the Tailwind v4 theme**

In `app/globals.css`, add to the existing `@theme inline { ... }` block (alongside the `--font-sans` line already there):

```css
  --color-gold: #B08D57;
  --color-ink: #0B0B0C;
  --font-serif: var(--font-serif);
```

- [ ] **Step 4: Wire the fonts and background in the root layout**

In `app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-serif' });
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'KB Personals — Financial Tracker',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="mx-auto min-h-screen max-w-md bg-[#FAFAFA] font-sans text-neutral-900">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run globals-theme.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/globals.css globals-theme.test.ts app/layout.tsx
git commit -m "feat: add gold/ink design tokens and serif/sans font wiring"
```

---

### Task 3: Shared Types & Date Utilities

**Files:**
- Create: `lib/types.ts`
- Create: `lib/date-utils.ts`
- Test: `lib/date-utils.test.ts`

**Interfaces:**
- Produces: `CalendarEvent { id: string; type: 'bill' | 'reminder' | 'task'; title: string; date: string; time?: string; amount?: number }`, `CalendarDay { date: Date; isCurrentMonth: boolean }`, `getMonthGrid(monthDate: Date): CalendarDay[]`, `formatMonthLabel(date: Date): string`, `toISODateString(date: Date): string`.

- [ ] **Step 1: Write the failing test**

Create `lib/date-utils.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getMonthGrid, formatMonthLabel, toISODateString } from './date-utils';

describe('date-utils', () => {
  it('formats a month label as "Month YYYY"', () => {
    expect(formatMonthLabel(new Date(2026, 7, 6))).toBe('August 2026');
  });

  it('formats a date as an ISO yyyy-MM-dd string', () => {
    expect(toISODateString(new Date(2026, 7, 6))).toBe('2026-08-06');
  });

  it('returns a full 6-week grid padded with adjacent months', () => {
    const grid = getMonthGrid(new Date(2026, 7, 1));
    expect(grid.length).toBe(42);
    expect(grid[0].date.getDay()).toBe(0);
    expect(grid.filter((day) => day.isCurrentMonth).length).toBe(31);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run lib/date-utils.test.ts
```

Expected: FAIL — `lib/date-utils.ts` does not exist yet.

- [ ] **Step 3: Write the types**

Create `lib/types.ts`:

```ts
export type EventType = 'bill' | 'reminder' | 'task';

export interface CalendarEvent {
  id: string;
  type: EventType;
  title: string;
  date: string; // ISO 'yyyy-MM-dd'
  time?: string;
  amount?: number;
}
```

- [ ] **Step 4: Write the date utilities**

Create `lib/date-utils.ts`:

```ts
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  format,
} from 'date-fns';

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
}

export function getMonthGrid(monthDate: Date): CalendarDay[] {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  return eachDayOfInterval({ start: gridStart, end: gridEnd }).map((date) => ({
    date,
    isCurrentMonth: isSameMonth(date, monthDate),
  }));
}

export function formatMonthLabel(date: Date): string {
  return format(date, 'MMMM yyyy');
}

export function toISODateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run lib/date-utils.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/date-utils.ts lib/date-utils.test.ts
git commit -m "feat: add shared calendar types and date-grid utilities"
```

---

### Task 4: Mock Data

**Files:**
- Create: `lib/mock-data.ts`
- Test: `lib/mock-data.test.ts`

**Interfaces:**
- Consumes: `CalendarEvent` from `lib/types.ts`; `toISODateString` from `lib/date-utils.ts`.
- Produces: `generateMockEvents(baseDate?: Date): CalendarEvent[]`, `mockEvents: CalendarEvent[]` (computed relative to the current date at import time).

- [ ] **Step 1: Write the failing test**

Create `lib/mock-data.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { generateMockEvents } from './mock-data';

describe('generateMockEvents', () => {
  const events = generateMockEvents(new Date(2026, 7, 1));

  it('generates events within the given month', () => {
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event.date.startsWith('2026-08')).toBe(true);
    }
  });

  it('includes every event type', () => {
    const types = new Set(events.map((event) => event.type));
    expect(types).toEqual(new Set(['bill', 'reminder', 'task']));
  });

  it('gives bills a positive amount and non-bills no amount', () => {
    for (const event of events) {
      if (event.type === 'bill') {
        expect(event.amount).toBeGreaterThan(0);
      } else {
        expect(event.amount).toBeUndefined();
      }
    }
  });

  it('assigns each event a unique id', () => {
    const ids = events.map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run lib/mock-data.test.ts
```

Expected: FAIL — `lib/mock-data.ts` does not exist yet.

- [ ] **Step 3: Write the mock data generator**

Create `lib/mock-data.ts`:

```ts
import { addDays, startOfMonth } from 'date-fns';
import type { CalendarEvent } from './types';
import { toISODateString } from './date-utils';

interface MockEventSeed {
  dayOffset: number;
  type: CalendarEvent['type'];
  title: string;
  time?: string;
  amount?: number;
}

const EVENT_SEEDS: MockEventSeed[] = [
  { dayOffset: 2, type: 'bill', title: 'Electricity Bill', time: '9:00 AM', amount: 84.5 },
  { dayOffset: 4, type: 'reminder', title: 'Call insurance provider', time: '2:00 PM' },
  { dayOffset: 6, type: 'task', title: 'Review monthly budget' },
  { dayOffset: 9, type: 'bill', title: 'Internet Bill', time: '9:00 AM', amount: 59.99 },
  { dayOffset: 12, type: 'reminder', title: "Mom's birthday" },
  { dayOffset: 14, type: 'bill', title: 'Credit Card Payment', time: '11:00 AM', amount: 320.15 },
  { dayOffset: 14, type: 'task', title: 'Reconcile receipts' },
  { dayOffset: 18, type: 'reminder', title: 'Renew car insurance' },
  { dayOffset: 21, type: 'bill', title: 'Rent', time: '8:00 AM', amount: 1450 },
  { dayOffset: 25, type: 'task', title: 'Plan next month budget' },
];

export function generateMockEvents(baseDate: Date = new Date()): CalendarEvent[] {
  const monthStart = startOfMonth(baseDate);

  return EVENT_SEEDS.map(({ dayOffset, ...rest }, index) => ({
    id: `mock-${index}`,
    date: toISODateString(addDays(monthStart, dayOffset)),
    ...rest,
  }));
}

export const mockEvents: CalendarEvent[] = generateMockEvents();
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run lib/mock-data.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/mock-data.ts lib/mock-data.test.ts
git commit -m "feat: add typed mock calendar events"
```

---

### Task 5: `useCalendarEvents` Hook

**Files:**
- Create: `lib/use-calendar-events.ts`
- Test: `lib/use-calendar-events.test.ts`

**Interfaces:**
- Consumes: `mockEvents` from `lib/mock-data.ts`; `toISODateString` from `lib/date-utils.ts`; `CalendarEvent` from `lib/types.ts`.
- Produces: `useCalendarEvents(): { events: CalendarEvent[]; getEventsForDate: (date: Date) => CalendarEvent[] }`.

- [ ] **Step 1: Write the failing test**

Create `lib/use-calendar-events.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('./mock-data', () => ({
  mockEvents: [
    { id: '1', type: 'bill', title: 'Test Bill', date: '2026-08-10', amount: 10 },
    { id: '2', type: 'task', title: 'Test Task', date: '2026-08-10' },
  ],
}));

import { useCalendarEvents } from './use-calendar-events';

describe('useCalendarEvents', () => {
  it('groups mock events by their ISO date', () => {
    const { result } = renderHook(() => useCalendarEvents());
    const events = result.current.getEventsForDate(new Date(2026, 7, 10));
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.id)).toEqual(['1', '2']);
  });

  it('returns an empty array for a date with no events', () => {
    const { result } = renderHook(() => useCalendarEvents());
    const events = result.current.getEventsForDate(new Date(2099, 0, 1));
    expect(events).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run lib/use-calendar-events.test.ts
```

Expected: FAIL — `lib/use-calendar-events.ts` does not exist yet.

- [ ] **Step 3: Write the hook**

Create `lib/use-calendar-events.ts`:

```ts
'use client';

import { useMemo } from 'react';
import { mockEvents } from './mock-data';
import type { CalendarEvent } from './types';
import { toISODateString } from './date-utils';

export function useCalendarEvents() {
  const events = mockEvents;

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const existing = map.get(event.date) ?? [];
      existing.push(event);
      map.set(event.date, existing);
    }
    return map;
  }, [events]);

  function getEventsForDate(date: Date): CalendarEvent[] {
    return eventsByDate.get(toISODateString(date)) ?? [];
  }

  return { events, getEventsForDate };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run lib/use-calendar-events.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/use-calendar-events.ts lib/use-calendar-events.test.ts
git commit -m "feat: add useCalendarEvents hook over mock data"
```

---

### Task 6: `EventCard` Component

**Files:**
- Create: `components/calendar/EventCard.tsx`
- Test: `components/calendar/EventCard.test.tsx`

**Interfaces:**
- Consumes: `CalendarEvent` from `lib/types.ts`.
- Produces: `EventCard({ event: CalendarEvent }): JSX.Element`, rendered with `data-testid="event-card"`.

- [ ] **Step 1: Write the failing test**

Create `components/calendar/EventCard.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventCard } from './EventCard';
import type { CalendarEvent } from '@/lib/types';

const billEvent: CalendarEvent = {
  id: '1',
  type: 'bill',
  title: 'Electricity Bill',
  date: '2026-08-08',
  time: '9:00 AM',
  amount: 84.5,
};

const taskEvent: CalendarEvent = {
  id: '2',
  type: 'task',
  title: 'Review budget',
  date: '2026-08-08',
};

describe('EventCard', () => {
  it('renders a bill with its formatted amount', () => {
    render(<EventCard event={billEvent} />);
    expect(screen.getByText('Electricity Bill')).toBeInTheDocument();
    expect(screen.getByText('$84.50')).toBeInTheDocument();
    expect(screen.getByText('Bill · 9:00 AM')).toBeInTheDocument();
  });

  it('renders a task without an amount', () => {
    render(<EventCard event={taskEvent} />);
    expect(screen.getByText('Review budget')).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run components/calendar/EventCard.test.tsx
```

Expected: FAIL — `components/calendar/EventCard.tsx` does not exist yet.

- [ ] **Step 3: Write the component**

Create `components/calendar/EventCard.tsx`:

```tsx
import type { CalendarEvent } from '@/lib/types';

const TYPE_LABEL: Record<CalendarEvent['type'], string> = {
  bill: 'Bill',
  reminder: 'Reminder',
  task: 'Task',
};

const TYPE_DOT_CLASS: Record<CalendarEvent['type'], string> = {
  bill: 'bg-gold',
  reminder: 'bg-neutral-400',
  task: 'border border-neutral-400 bg-transparent',
};

export function EventCard({ event }: { event: CalendarEvent }) {
  return (
    <div
      data-testid="event-card"
      className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${TYPE_DOT_CLASS[event.type]}`} aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-neutral-900">{event.title}</p>
          <p className="text-xs text-neutral-500">
            {TYPE_LABEL[event.type]}
            {event.time ? ` · ${event.time}` : ''}
          </p>
        </div>
      </div>
      {event.amount !== undefined && (
        <span className="font-serif text-sm text-neutral-900">${event.amount.toFixed(2)}</span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run components/calendar/EventCard.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/calendar/EventCard.tsx components/calendar/EventCard.test.tsx
git commit -m "feat: add EventCard component"
```

---

### Task 7: `DayCell` Component

**Files:**
- Create: `components/calendar/DayCell.tsx`
- Test: `components/calendar/DayCell.test.tsx`

**Interfaces:**
- Consumes: `CalendarDay` from `lib/date-utils.ts`; `CalendarEvent` from `lib/types.ts`.
- Produces: `DayCell({ day: CalendarDay; events: CalendarEvent[]; isSelected: boolean; onSelect: (date: Date) => void }): JSX.Element`, rendered with `data-testid="day-cell"` and `aria-pressed`.

- [ ] **Step 1: Write the failing test**

Create `components/calendar/DayCell.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DayCell } from './DayCell';
import type { CalendarEvent } from '@/lib/types';

const day = { date: new Date(2026, 7, 10), isCurrentMonth: true };
const events: CalendarEvent[] = [{ id: '1', type: 'bill', title: 'Bill', date: '2026-08-10', amount: 10 }];

describe('DayCell', () => {
  it('renders the day number', () => {
    render(<DayCell day={day} events={events} isSelected={false} onSelect={() => {}} />);
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('calls onSelect with the day date when clicked', () => {
    const onSelect = vi.fn();
    render(<DayCell day={day} events={[]} isSelected={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('day-cell'));
    expect(onSelect).toHaveBeenCalledWith(day.date);
  });

  it('marks itself pressed when selected', () => {
    render(<DayCell day={day} events={[]} isSelected onSelect={() => {}} />);
    expect(screen.getByTestId('day-cell')).toHaveAttribute('aria-pressed', 'true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run components/calendar/DayCell.test.tsx
```

Expected: FAIL — `components/calendar/DayCell.tsx` does not exist yet.

- [ ] **Step 3: Write the component**

Create `components/calendar/DayCell.tsx`:

```tsx
'use client';

import { isToday } from 'date-fns';
import type { CalendarDay } from '@/lib/date-utils';
import type { CalendarEvent } from '@/lib/types';

const TYPE_DOT_CLASS: Record<CalendarEvent['type'], string> = {
  bill: 'bg-gold',
  reminder: 'bg-neutral-400',
  task: 'border border-neutral-400',
};

interface DayCellProps {
  day: CalendarDay;
  events: CalendarEvent[];
  isSelected: boolean;
  onSelect: (date: Date) => void;
}

export function DayCell({ day, events, isSelected, onSelect }: DayCellProps) {
  const today = isToday(day.date);
  const uniqueTypes = Array.from(new Set(events.map((e) => e.type)));

  return (
    <button
      type="button"
      data-testid="day-cell"
      onClick={() => onSelect(day.date)}
      aria-pressed={isSelected}
      className={[
        'flex h-11 w-11 flex-col items-center justify-center gap-1 rounded-full text-sm transition-colors',
        day.isCurrentMonth ? 'text-neutral-900' : 'text-neutral-300',
        today ? 'ring-2 ring-gold' : '',
        isSelected ? 'bg-neutral-900 text-white' : '',
      ].join(' ')}
    >
      <span>{day.date.getDate()}</span>
      <span className="flex gap-0.5">
        {uniqueTypes.map((type) => (
          <span key={type} className={`h-1.5 w-1.5 rounded-full ${TYPE_DOT_CLASS[type]}`} />
        ))}
      </span>
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run components/calendar/DayCell.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/calendar/DayCell.tsx components/calendar/DayCell.test.tsx
git commit -m "feat: add DayCell component"
```

---

### Task 8: `MonthGrid` Component

**Files:**
- Create: `components/calendar/MonthGrid.tsx`
- Test: `components/calendar/MonthGrid.test.tsx`

**Interfaces:**
- Consumes: `getMonthGrid`, `formatMonthLabel`, `toISODateString` from `lib/date-utils.ts`; `DayCell` from `./DayCell`; `CalendarEvent` from `lib/types.ts`.
- Produces: `MonthGrid({ getEventsForDate: (date: Date) => CalendarEvent[]; selectedDate: Date; onSelectDate: (date: Date) => void }): JSX.Element`, rendered with `data-testid="month-grid"`.

- [ ] **Step 1: Write the failing test**

Create `components/calendar/MonthGrid.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MonthGrid } from './MonthGrid';

describe('MonthGrid', () => {
  const noEvents = () => [];

  it('renders 42 day cells for a full 6-week grid', () => {
    render(<MonthGrid getEventsForDate={noEvents} selectedDate={new Date(2026, 7, 6)} onSelectDate={() => {}} />);
    expect(screen.getAllByTestId('day-cell')).toHaveLength(42);
  });

  it('shows the current visible month label', () => {
    render(<MonthGrid getEventsForDate={noEvents} selectedDate={new Date(2026, 7, 6)} onSelectDate={() => {}} />);
    expect(screen.getByText('August 2026')).toBeInTheDocument();
  });

  it('navigates to the next month on next-month click', () => {
    render(<MonthGrid getEventsForDate={noEvents} selectedDate={new Date(2026, 7, 6)} onSelectDate={() => {}} />);
    fireEvent.click(screen.getByLabelText('Next month'));
    expect(screen.getByText('September 2026')).toBeInTheDocument();
  });

  it('calls onSelectDate when a day cell is clicked', () => {
    const onSelectDate = vi.fn();
    render(<MonthGrid getEventsForDate={noEvents} selectedDate={new Date(2026, 7, 6)} onSelectDate={onSelectDate} />);
    fireEvent.click(screen.getAllByTestId('day-cell')[10]);
    expect(onSelectDate).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run components/calendar/MonthGrid.test.tsx
```

Expected: FAIL — `components/calendar/MonthGrid.tsx` does not exist yet.

- [ ] **Step 3: Write the component**

Create `components/calendar/MonthGrid.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { addMonths, subMonths } from 'date-fns';
import { getMonthGrid, formatMonthLabel, toISODateString } from '@/lib/date-utils';
import { DayCell } from './DayCell';
import type { CalendarEvent } from '@/lib/types';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface MonthGridProps {
  getEventsForDate: (date: Date) => CalendarEvent[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export function MonthGrid({ getEventsForDate, selectedDate, onSelectDate }: MonthGridProps) {
  const [visibleMonth, setVisibleMonth] = useState(selectedDate);
  const days = getMonthGrid(visibleMonth);

  return (
    <div data-testid="month-grid">
      <div className="mb-4 flex items-center justify-between">
        <button type="button" aria-label="Previous month" onClick={() => setVisibleMonth((m) => subMonths(m, 1))}>
          ‹
        </button>
        <p className="font-serif text-lg text-neutral-900">{formatMonthLabel(visibleMonth)}</p>
        <button type="button" aria-label="Next month" onClick={() => setVisibleMonth((m) => addMonths(m, 1))}>
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-2 text-center text-xs text-neutral-400">
        {WEEKDAY_LABELS.map((label, i) => (
          <span key={`${label}-${i}`}>{label}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 justify-items-center gap-y-2">
        {days.map((day) => (
          <DayCell
            key={toISODateString(day.date)}
            day={day}
            events={getEventsForDate(day.date)}
            isSelected={toISODateString(day.date) === toISODateString(selectedDate)}
            onSelect={onSelectDate}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run components/calendar/MonthGrid.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/calendar/MonthGrid.tsx components/calendar/MonthGrid.test.tsx
git commit -m "feat: add MonthGrid component with month navigation"
```

---

### Task 9: `EmptyState` & `DayDetailPanel` Components

**Files:**
- Create: `components/shared/EmptyState.tsx`
- Create: `components/calendar/DayDetailPanel.tsx`
- Test: `components/calendar/DayDetailPanel.test.tsx`

**Interfaces:**
- Consumes: `EventCard` from `./EventCard`; `EmptyState` from `@/components/shared/EmptyState`; `CalendarEvent` from `lib/types.ts`.
- Produces: `EmptyState({ message: string }): JSX.Element` (`data-testid="empty-state"`); `DayDetailPanel({ date: Date; events: CalendarEvent[] }): JSX.Element` (`data-testid="day-detail-panel"`).

- [ ] **Step 1: Write the failing test**

Create `components/calendar/DayDetailPanel.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DayDetailPanel } from './DayDetailPanel';
import type { CalendarEvent } from '@/lib/types';

describe('DayDetailPanel', () => {
  it('shows an empty state when there are no events', () => {
    render(<DayDetailPanel date={new Date(2026, 7, 10)} events={[]} />);
    expect(screen.getByTestId('empty-state')).toHaveTextContent('Nothing scheduled');
  });

  it('lists each event as a card', () => {
    const events: CalendarEvent[] = [
      { id: '1', type: 'bill', title: 'Rent', date: '2026-08-10', amount: 1450 },
      { id: '2', type: 'task', title: 'Budget review', date: '2026-08-10' },
    ];
    render(<DayDetailPanel date={new Date(2026, 7, 10)} events={events} />);
    expect(screen.getAllByTestId('event-card')).toHaveLength(2);
  });

  it('shows the formatted date heading', () => {
    render(<DayDetailPanel date={new Date(2026, 7, 10)} events={[]} />);
    expect(screen.getByText('Monday, August 10')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run components/calendar/DayDetailPanel.test.tsx
```

Expected: FAIL — `components/calendar/DayDetailPanel.tsx` does not exist yet.

- [ ] **Step 3: Write `EmptyState`**

Create `components/shared/EmptyState.tsx`:

```tsx
export function EmptyState({ message }: { message: string }) {
  return (
    <div
      data-testid="empty-state"
      className="rounded-2xl border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-400"
    >
      {message}
    </div>
  );
}
```

- [ ] **Step 4: Write `DayDetailPanel`**

Create `components/calendar/DayDetailPanel.tsx`:

```tsx
import { format } from 'date-fns';
import { EventCard } from './EventCard';
import { EmptyState } from '@/components/shared/EmptyState';
import type { CalendarEvent } from '@/lib/types';

interface DayDetailPanelProps {
  date: Date;
  events: CalendarEvent[];
}

export function DayDetailPanel({ date, events }: DayDetailPanelProps) {
  return (
    <div data-testid="day-detail-panel" className="mt-6 flex flex-col gap-2">
      <p className="text-sm font-medium text-neutral-500">{format(date, 'EEEE, MMMM d')}</p>
      {events.length === 0 ? (
        <EmptyState message="Nothing scheduled" />
      ) : (
        events.map((event) => <EventCard key={event.id} event={event} />)
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run components/calendar/DayDetailPanel.test.tsx
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/shared/EmptyState.tsx components/calendar/DayDetailPanel.tsx components/calendar/DayDetailPanel.test.tsx
git commit -m "feat: add EmptyState and DayDetailPanel components"
```

---

### Task 10: Home Page Composition

**Files:**
- Modify: `app/page.tsx`
- Test: `app/page.test.tsx`

**Interfaces:**
- Consumes: `MonthGrid` from `@/components/calendar/MonthGrid`; `DayDetailPanel` from `@/components/calendar/DayDetailPanel`; `useCalendarEvents` from `@/lib/use-calendar-events`; `Button` from `@/components/ui/button`; `Sheet`, `SheetContent`, `SheetTrigger` from `@/components/ui/sheet`.
- Produces: the Home route (`/`), rendering `data-testid="home-page"`, `data-testid="add-event-button"`, `data-testid="add-event-sheet"`.

- [ ] **Step 1: Write the failing test**

Create `app/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HomePage from './page';

vi.mock('@/lib/use-calendar-events', () => ({
  useCalendarEvents: () => ({
    getEventsForDate: () => [],
  }),
}));

describe('HomePage', () => {
  it('renders the month grid and day detail panel', () => {
    render(<HomePage />);
    expect(screen.getByTestId('month-grid')).toBeInTheDocument();
    expect(screen.getByTestId('day-detail-panel')).toBeInTheDocument();
  });

  it('opens a "Coming soon" sheet when the add button is tapped', () => {
    render(<HomePage />);
    fireEvent.click(screen.getByTestId('add-event-button'));
    expect(screen.getByTestId('add-event-sheet')).toHaveTextContent('Coming soon');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run app/page.test.tsx
```

Expected: FAIL — the current `app/page.tsx` is still the create-next-app boilerplate.

- [ ] **Step 3: Write the Home page**

Replace `app/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { MonthGrid } from '@/components/calendar/MonthGrid';
import { DayDetailPanel } from '@/components/calendar/DayDetailPanel';
import { useCalendarEvents } from '@/lib/use-calendar-events';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

export default function HomePage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const { getEventsForDate } = useCalendarEvents();

  return (
    <div data-testid="home-page" className="flex flex-col px-4 pb-24 pt-4">
      <MonthGrid getEventsForDate={getEventsForDate} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
      <DayDetailPanel date={selectedDate} events={getEventsForDate(selectedDate)} />
      <Sheet>
        <SheetTrigger asChild>
          <Button
            data-testid="add-event-button"
            aria-label="Add event"
            className="fixed bottom-24 right-4 h-14 w-14 rounded-full bg-neutral-900 text-2xl text-white shadow-lg"
          >
            +
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" data-testid="add-event-sheet">
          <p className="py-8 text-center text-neutral-500">Coming soon</p>
        </SheetContent>
      </Sheet>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run app/page.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/page.test.tsx
git commit -m "feat: compose Home screen from MonthGrid, DayDetailPanel, and add-event stub"
```

---

### Task 11: `Header` Component & Tab Config

**Files:**
- Create: `components/shell/tab-config.ts`
- Create: `components/shell/Header.tsx`
- Test: `components/shell/Header.test.tsx`

**Interfaces:**
- Produces: `TabItem { href: string; label: string; icon: LucideIcon }`, `TAB_ITEMS: TabItem[]` (single source of truth for nav, reused by `TabBar` in Task 12); `Header(): JSX.Element` (`data-testid="app-header"`).

- [ ] **Step 1: Write the failing test**

Create `components/shell/Header.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/budget',
}));

import { Header } from './Header';

describe('Header', () => {
  it('shows the title matching the current route', () => {
    render(<Header />);
    expect(screen.getByText('Budget')).toBeInTheDocument();
  });

  it('renders the KB monogram chip', () => {
    render(<Header />);
    expect(screen.getByText('KB')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run components/shell/Header.test.tsx
```

Expected: FAIL — `components/shell/Header.tsx` does not exist yet.

- [ ] **Step 3: Write the tab config**

Create `components/shell/tab-config.ts`:

```ts
import { Home, PieChart, Receipt, Bell, Camera } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface TabItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const TAB_ITEMS: TabItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/budget', label: 'Budget', icon: PieChart },
  { href: '/bills', label: 'Bills', icon: Receipt },
  { href: '/reminders', label: 'Reminders', icon: Bell },
  { href: '/receipts', label: 'Receipts', icon: Camera },
];
```

- [ ] **Step 4: Write the Header**

Create `components/shell/Header.tsx`:

```tsx
'use client';

import { usePathname } from 'next/navigation';
import { TAB_ITEMS } from './tab-config';

export function Header() {
  const pathname = usePathname();
  const title = TAB_ITEMS.find((tab) => tab.href === pathname)?.label ?? 'Home';

  return (
    <header data-testid="app-header" className="flex items-center gap-3 px-4 pb-2 pt-6">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-serif text-sm text-gold">
        KB
      </span>
      <h1 className="font-serif text-xl text-neutral-900">{title}</h1>
    </header>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run components/shell/Header.test.tsx
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/shell/tab-config.ts components/shell/Header.tsx components/shell/Header.test.tsx
git commit -m "feat: add tab config and Header component"
```

---

### Task 12: `TabBar` Component

**Files:**
- Create: `components/shell/TabBar.tsx`
- Test: `components/shell/TabBar.test.tsx`

**Interfaces:**
- Consumes: `TAB_ITEMS` from `./tab-config`.
- Produces: `TabBar(): JSX.Element` (`data-testid="tab-bar"`, per-tab `data-testid="tab-<label-lowercase>"`, `aria-current="page"` on the active tab).

- [ ] **Step 1: Write the failing test**

Create `components/shell/TabBar.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

import { TabBar } from './TabBar';

describe('TabBar', () => {
  it('renders all five tabs', () => {
    render(<TabBar />);
    expect(screen.getByTestId('tab-home')).toBeInTheDocument();
    expect(screen.getByTestId('tab-budget')).toBeInTheDocument();
    expect(screen.getByTestId('tab-bills')).toBeInTheDocument();
    expect(screen.getByTestId('tab-reminders')).toBeInTheDocument();
    expect(screen.getByTestId('tab-receipts')).toBeInTheDocument();
  });

  it('marks the current route as active', () => {
    render(<TabBar />);
    expect(screen.getByTestId('tab-home')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('tab-budget')).not.toHaveAttribute('aria-current');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run components/shell/TabBar.test.tsx
```

Expected: FAIL — `components/shell/TabBar.tsx` does not exist yet.

- [ ] **Step 3: Write the component**

Create `components/shell/TabBar.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TAB_ITEMS } from './tab-config';

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      data-testid="tab-bar"
      className="fixed inset-x-0 bottom-0 flex justify-around border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] pt-2"
    >
      {TAB_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            data-testid={`tab-${label.toLowerCase()}`}
            aria-current={isActive ? 'page' : undefined}
            className="relative flex flex-col items-center gap-1 px-3 pb-2 text-xs"
          >
            <Icon className={isActive ? 'h-5 w-5 text-gold' : 'h-5 w-5 text-neutral-400'} strokeWidth={isActive ? 2.5 : 2} />
            <span className={isActive ? 'text-gold' : 'text-neutral-400'}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run components/shell/TabBar.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/shell/TabBar.tsx components/shell/TabBar.test.tsx
git commit -m "feat: add TabBar component with 5-tab navigation"
```

---

### Task 13: `PlaceholderScreen` & Stub Routes

**Files:**
- Create: `components/shared/PlaceholderScreen.tsx`
- Create: `app/budget/page.tsx`, `app/bills/page.tsx`, `app/reminders/page.tsx`, `app/receipts/page.tsx`
- Test: `components/shared/PlaceholderScreen.test.tsx`, `app/budget/page.test.tsx`, `app/bills/page.test.tsx`, `app/reminders/page.test.tsx`, `app/receipts/page.test.tsx`

**Interfaces:**
- Produces: `PlaceholderScreen({ title: string }): JSX.Element` (`data-testid="placeholder-screen"`).

- [ ] **Step 1: Write the failing tests**

Create `components/shared/PlaceholderScreen.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlaceholderScreen } from './PlaceholderScreen';

describe('PlaceholderScreen', () => {
  it('renders the given title and a coming-soon message', () => {
    render(<PlaceholderScreen title="Budget" />);
    expect(screen.getByText('Budget')).toBeInTheDocument();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
  });
});
```

Create `app/budget/page.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import BudgetPage from './page';

describe('BudgetPage', () => {
  it('renders the Budget placeholder', () => {
    render(<BudgetPage />);
    expect(screen.getByText('Budget')).toBeInTheDocument();
  });
});
```

Create `app/bills/page.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import BillsPage from './page';

describe('BillsPage', () => {
  it('renders the Bills placeholder', () => {
    render(<BillsPage />);
    expect(screen.getByText('Bills')).toBeInTheDocument();
  });
});
```

Create `app/reminders/page.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import RemindersPage from './page';

describe('RemindersPage', () => {
  it('renders the Reminders placeholder', () => {
    render(<RemindersPage />);
    expect(screen.getByText('Reminders')).toBeInTheDocument();
  });
});
```

Create `app/receipts/page.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReceiptsPage from './page';

describe('ReceiptsPage', () => {
  it('renders the Receipts placeholder', () => {
    render(<ReceiptsPage />);
    expect(screen.getByText('Receipts')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run components/shared/PlaceholderScreen.test.tsx app/budget/page.test.tsx app/bills/page.test.tsx app/reminders/page.test.tsx app/receipts/page.test.tsx
```

Expected: FAIL — none of these files exist yet.

- [ ] **Step 3: Write `PlaceholderScreen`**

Create `components/shared/PlaceholderScreen.tsx`:

```tsx
interface PlaceholderScreenProps {
  title: string;
}

export function PlaceholderScreen({ title }: PlaceholderScreenProps) {
  return (
    <div data-testid="placeholder-screen" className="flex flex-col items-center justify-center gap-2 px-4 pb-24 pt-24 text-center">
      <p className="font-serif text-lg text-neutral-900">{title}</p>
      <p className="text-sm text-neutral-400">Coming soon</p>
    </div>
  );
}
```

- [ ] **Step 4: Write the four stub route pages**

Create `app/budget/page.tsx`:

```tsx
import { PlaceholderScreen } from '@/components/shared/PlaceholderScreen';

export default function BudgetPage() {
  return <PlaceholderScreen title="Budget" />;
}
```

Create `app/bills/page.tsx`:

```tsx
import { PlaceholderScreen } from '@/components/shared/PlaceholderScreen';

export default function BillsPage() {
  return <PlaceholderScreen title="Bills" />;
}
```

Create `app/reminders/page.tsx`:

```tsx
import { PlaceholderScreen } from '@/components/shared/PlaceholderScreen';

export default function RemindersPage() {
  return <PlaceholderScreen title="Reminders" />;
}
```

Create `app/receipts/page.tsx`:

```tsx
import { PlaceholderScreen } from '@/components/shared/PlaceholderScreen';

export default function ReceiptsPage() {
  return <PlaceholderScreen title="Receipts" />;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run components/shared/PlaceholderScreen.test.tsx app/budget/page.test.tsx app/bills/page.test.tsx app/reminders/page.test.tsx app/receipts/page.test.tsx
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/shared/PlaceholderScreen.tsx components/shared/PlaceholderScreen.test.tsx app/budget app/bills app/reminders app/receipts
git commit -m "feat: add PlaceholderScreen and stub routes for Budget/Bills/Reminders/Receipts"
```

---

### Task 14: Wire the App Shell into the Root Layout

**Files:**
- Create: `components/shell/AppShell.tsx`
- Test: `components/shell/AppShell.test.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `Header` from `./Header`; `TabBar` from `./TabBar`.
- Produces: `AppShell({ children: ReactNode }): JSX.Element` rendering `data-testid="app-shell-main"` around `children`, with the header and tab bar.

`app/layout.tsx` returns `<html>`/`<body>`, which React Testing Library cannot mount directly (jsdom already provides those). `AppShell` is the testable extraction point; `layout.tsx` itself is verified manually in Step 5.

- [ ] **Step 1: Write the failing test**

Create `components/shell/AppShell.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

import { AppShell } from './AppShell';

describe('AppShell', () => {
  it('renders the header, tab bar, and page content together', () => {
    render(
      <AppShell>
        <p>page content</p>
      </AppShell>
    );
    expect(screen.getByTestId('app-header')).toBeInTheDocument();
    expect(screen.getByTestId('tab-bar')).toBeInTheDocument();
    expect(screen.getByText('page content')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run components/shell/AppShell.test.tsx
```

Expected: FAIL — `components/shell/AppShell.tsx` does not exist yet.

- [ ] **Step 3: Write `AppShell`**

Create `components/shell/AppShell.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Header } from './Header';
import { TabBar } from './TabBar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main data-testid="app-shell-main">{children}</main>
      <TabBar />
    </>
  );
}
```

- [ ] **Step 4: Wire `AppShell` into the root layout**

Update `app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import { AppShell } from '@/components/shell/AppShell';
import './globals.css';

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-serif' });
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'KB Personals — Financial Tracker',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="mx-auto min-h-screen max-w-md bg-[#FAFAFA] font-sans text-neutral-900">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Run test to verify it passes, then verify manually in the browser**

```bash
npx vitest run components/shell/AppShell.test.tsx
```

Expected: PASS

Then:

```bash
npm run dev
```

Open `http://localhost:3000` and confirm: header with KB chip + "Home" title, calendar grid, bottom tab bar with 5 tabs. Click each of the other 4 tabs and confirm the placeholder screens render with the same header/tab-bar chrome.

- [ ] **Step 6: Commit**

```bash
git add components/shell/AppShell.tsx components/shell/AppShell.test.tsx app/layout.tsx
git commit -m "feat: wire Header and TabBar into the root layout via AppShell"
```

---

### Task 15: Motion Polish

**Files:**
- Modify: `components/shell/TabBar.tsx`
- Modify: `components/shell/TabBar.test.tsx`
- Modify: `components/calendar/DayDetailPanel.tsx`

**Interfaces:**
- Consumes: `motion`, `AnimatePresence` from `framer-motion`.
- Produces: no new public interfaces — visual/behavioral refinement only. `TabBar` gains a `data-testid="tab-indicator"` element under the active tab.

- [ ] **Step 1: Write the failing test for the tab indicator**

In `components/shell/TabBar.test.tsx`, add (keep the existing two tests, add this import and test):

```tsx
import { within } from '@testing-library/react';
```

```tsx
it('renders an animated indicator under the active tab', () => {
  render(<TabBar />);
  const homeLink = screen.getByTestId('tab-home');
  expect(within(homeLink).getByTestId('tab-indicator')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run components/shell/TabBar.test.tsx
```

Expected: FAIL — no `tab-indicator` element exists yet.

- [ ] **Step 3: Add the animated indicator to `TabBar`**

Update `components/shell/TabBar.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { TAB_ITEMS } from './tab-config';

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      data-testid="tab-bar"
      className="fixed inset-x-0 bottom-0 flex justify-around border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] pt-2"
    >
      {TAB_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            data-testid={`tab-${label.toLowerCase()}`}
            aria-current={isActive ? 'page' : undefined}
            className="relative flex flex-col items-center gap-1 px-3 pb-2 text-xs"
          >
            <Icon className={isActive ? 'h-5 w-5 text-gold' : 'h-5 w-5 text-neutral-400'} strokeWidth={isActive ? 2.5 : 2} />
            <span className={isActive ? 'text-gold' : 'text-neutral-400'}>{label}</span>
            {isActive && (
              <motion.span
                layoutId="tab-indicator"
                data-testid="tab-indicator"
                className="absolute -top-2 h-0.5 w-6 rounded-full bg-gold"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run components/shell/TabBar.test.tsx
```

Expected: PASS (all three tests)

- [ ] **Step 5: Add stagger animation to `DayDetailPanel`**

Update `components/calendar/DayDetailPanel.tsx`:

```tsx
'use client';

import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { EventCard } from './EventCard';
import { EmptyState } from '@/components/shared/EmptyState';
import type { CalendarEvent } from '@/lib/types';

interface DayDetailPanelProps {
  date: Date;
  events: CalendarEvent[];
}

export function DayDetailPanel({ date, events }: DayDetailPanelProps) {
  return (
    <div data-testid="day-detail-panel" className="mt-6 flex flex-col gap-2">
      <p className="text-sm font-medium text-neutral-500">{format(date, 'EEEE, MMMM d')}</p>
      {events.length === 0 ? (
        <EmptyState message="Nothing scheduled" />
      ) : (
        <AnimatePresence mode="popLayout">
          {events.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <EventCard event={event} />
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run the existing `DayDetailPanel` tests to confirm no regressions**

```bash
npx vitest run components/calendar/DayDetailPanel.test.tsx
```

Expected: PASS — the motion wrapper is transparent to the existing `event-card`/`empty-state`/date-heading assertions.

- [ ] **Step 7: Run the full test suite**

```bash
npm test
```

Expected: all tests across the project PASS.

- [ ] **Step 8: Manual browser verification**

```bash
npm run dev
```

In the browser: switch between all 5 tabs and confirm the gold indicator animates under the active tab; on Home, tap several days and confirm the event list fades/staggers in; tap a day with no events and confirm the empty state shows instantly; resize to a narrow mobile width and confirm layout holds (no horizontal scroll, touch targets remain comfortable).

- [ ] **Step 9: Commit**

```bash
git add components/shell/TabBar.tsx components/shell/TabBar.test.tsx components/calendar/DayDetailPanel.tsx
git commit -m "feat: add tab-switch indicator and day-detail stagger animation"
```

---

## Spec Coverage Check

- Bottom tab bar, 5 tabs, gold active state → Tasks 11, 12, 15
- Header with KB monogram, dynamic title → Task 11
- Month-grid calendar, today ring, event badges → Tasks 3, 7, 8
- Tap day → detail panel with cards, empty state → Task 9
- Stub add button/sheet ("Coming soon") → Task 10
- Placeholder screens for Budget/Bills/Reminders/Receipts → Task 13
- Typed mock data, swappable data layer → Tasks 3, 4, 5
- Design tokens (gold, ink, serif/sans, near-white bg) → Task 2
- Standard-polish motion (tab switch, day-select stagger) → Task 15
- Manual mobile/browser verification → Tasks 14, 15
