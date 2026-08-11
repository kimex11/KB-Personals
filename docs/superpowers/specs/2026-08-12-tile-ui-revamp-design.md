# App-Wide Tile UI/UX Revamp

Status: Approved (pending spec review)
Date: 2026-08-12

## Problem

The app's current visual language is dense horizontal list rows (`BillRow`, `ReminderRow`,
`CardDueRow`, `IncomeRow`) on a plain white background with a thin colored left-border
accent for status. The user wants a more tappable, glanceable "tile" design — bigger,
color-coded, grid-friendly cards — validated through mockups in this session's
brainstorming (see decisions below). This is a pure presentation-layer change: no
repository, hook, or database changes are needed anywhere in this project. Every
`use*` hook, every `*-repository.ts`, every Supabase table stays exactly as-is; only the
components that render lists and the Dashboard's top section change.

## Decisions (validated via mockup)

- **Bills, Reminders, Accounts** (credit cards + income sources) become a **2-column
  tile grid**, each tile with a **soft status-tinted background** — red for overdue,
  amber for due-soon/due-today, green for paid/success, gray for upcoming/neutral —
  built from this app's existing `status-critical`/`status-warning`/`status-success`
  color tokens at low opacity (e.g. `bg-status-critical/10`), not new colors.
- **Budget category cards and Manage Categories** stay **single-column**, restyled as
  chunkier tiles but not grid-ed: Budget's progress bar needs full width to stay
  legible at a glance, and Manage Categories' drag-to-reorder (via `dnd-kit`) stays
  simple (up/down only) rather than ambiguous 2D repositioning.
- **Dashboard** gets a new **2-column launcher tile grid** (Bills / Reminders / Budget /
  Accounts / Receipts, each showing one glance stat like "1 overdue" or "₱1,918 of
  ₱1,950") that **replaces** `QuickActionsRow` and sits near the top, right after the
  alerts banner. The existing detail widgets (calendar, weekly bills panel, spending
  snapshot chart, reminders panel) stay below, unchanged, as the richer at-a-glance
  view once the user is already on the dashboard.
- **Receipts** already renders as a 2-column image-tile grid (`ReceiptGrid`) — no
  structural change, just a spacing/corner-radius pass so it visually matches the new
  tile language.
- Every tile is one tap target — the whole card navigates or opens edit, not just an
  icon within it — comfortably past the 44px minimum this app already enforces
  elsewhere (`RowActionsMenu`, the checkbox rows fixed in the last audit pass).

## Architecture

A new shared primitive, `components/shared/Tile.tsx`, is the tappable tile shell every
entity-specific tile composes: rounded-2xl corners, a tinted background color passed in
as a prop, consistent internal padding, and the full-card click/keyboard handler (so
Enter/Space activates it same as a click, for keyboard and screen-reader users — the
current row components already get this via being wrapped in a real `<button>`/`<Link>`
in some cases and not others; the shared primitive standardizes it everywhere).

```
components/shared/Tile.tsx          -- generic tappable shell (bg tint, radius, onClick)
components/shared/TileGrid.tsx      -- grid-cols-2 gap wrapper (used by Bills/Reminders/Accounts)
components/bills/BillTile.tsx       -- replaces BillRow's rendering, reuses getBillStatus
components/reminders/ReminderTile.tsx -- replaces ReminderRow's rendering
components/accounts/CardDueTile.tsx / IncomeTile.tsx -- replace CardDueRow/IncomeRow
components/dashboard/LauncherTiles.tsx -- new: the Dashboard's top launcher grid
```

Existing selector functions (`getBillStatus`, `getDueDateStatus`, etc.) are reused
unchanged — they already compute the status that decides which tint a tile gets. The
mapping from status to tint (`Record<Status, string>` of Tailwind classes) is new, small,
and colocated with each tile component, following the existing pattern already used for
`STATUS_ACCENT_BORDER`/`STATUS_CARD_BG` in the current `BillRow` (which already has a
`bg-status-*/5` background per status — this revamp increases that tint's opacity and
converts the layout from a row to a grid tile, it is not starting from zero).

**Testing convention**: existing `data-testid`s (`bill-row`, `reminder-row`,
`card-due-row`, `income-row`) are **kept as-is** even though the components are
visually tiles now — renaming them would force a mechanical, low-value edit across every
test file that queries them, for no behavioral gain. `LauncherTiles` (new component,
new behavior — glance stats didn't exist before) gets fresh testids
(`launcher-tile-bills`, etc.), since there's no prior contract to preserve.

## Scope for the implementation plan

This touches enough screens that the plan should phase it rather than attempt
everything in one pass — a reasonable split or 4:
1. `Tile`/`TileGrid` shared primitives + `LauncherTiles` + Dashboard restructure
2. Bills + Reminders → `BillTile`/`ReminderTile`, 2-col grid
3. Accounts → `CardDueTile`/`IncomeTile`, 2-col grid
4. Budget + Manage Categories single-column tile polish, Receipts spacing pass

Each phase is independently shippable and testable — the app works correctly after any
one phase lands, since no phase depends on a later one (they're disjoint sets of
screens sharing only the Task 1 primitives).

## Testing

- Unit/component tests per tile component, following each existing `*Row.test.tsx`'s
  conventions (they already assert status-dependent styling via testids like
  `over-budget-label`/`bill-duplicate-warning` — those assertions carry over unchanged
  since the underlying status logic doesn't change, only the wrapping markup).
- `Tile`/`TileGrid` get their own focused tests: renders children, applies the tint
  class passed in, calls `onClick`/`onKeyDown` (Enter/Space) correctly.
- `LauncherTiles` gets new tests: renders one tile per section with the right glance
  stat text, each tile links to the right route.
- No test-suite-wide regression is expected — this plan does not touch any hook,
  repository, or Supabase migration.

## Out of scope

- Any new data/schema (this is presentation-only).
- Animations/transitions between tile states (could be a fast-follow, not required to
  ship the visual revamp).
- The Activity/Audit Log feature — queued as the next spec after this one, per the
  user's explicit sequencing choice this session.
