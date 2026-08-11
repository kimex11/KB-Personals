# Credit Card Payment History & Balance Trail

Status: Approved (pending final user sign-off on this doc)
Date: 2026-08-12

## Problem

There's currently no way to record a payment against a credit card or see how its balance changed over time. `credit_card_dues` has a single `statement_balance` field, directly editable via `CardDueForm` — there's no history, and no way to distinguish "I paid ₱300 toward this card" from "I corrected a typo in the balance." The user wants, per card: a full append-only payment ledger (amount, timestamp, balance before/after, method, notes), summary stats (total paid, payment count, remaining balance, last payment, next due date), and a dedicated place to see all of it — reachable by opening that specific card.

## Decisions

- **Entry point: a dedicated card detail page**, `/accounts/cards/[id]` (user's explicit choice over an inline-expanding tile or a modal) — a first for this app, which has no dynamic routes yet. `CardDueTile` gets a small "View history" link at the bottom to reach it; the tile itself stays as-is otherwise (it already has multiple interactive children — the paid-adjacent-N/A toggle doesn't apply here, but the actions menu does — so the whole tile isn't made a single tap target, consistent with how every other multi-control tile in this app works).
- **New append-only table, `credit_card_payments`**, one row per payment, FK'd to `credit_card_dues(id)` with `on delete cascade` (a payment record for a card that no longer exists isn't meaningful — this mirrors how every other child record in this app is scoped to its parent, e.g. `bills.category_id`). RLS: `select`/`insert` for authenticated users; **no `update`/`delete` policy** — same append-only pattern as `audit_log`, satisfying "must remain accurate even when balances... are edited later" at the database level, not just by convention.
- **`credit_card_dues.statement_balance` stays the single "current balance" field** — recording a payment updates it (to the payment's `balance_after`), but *only* through the new `recordCardPayment` repository function, which inserts the ledger row **first**, then updates the card's balance. If the update step ever failed after the insert succeeded, the worst case is a ledger entry not yet reflected in the card's balance (visible, recoverable) — never the reverse (a balance change with no audit trail, which is exactly what "audit-friendly" rules out). Editing a card directly via `CardDueForm` (e.g. a new billing cycle, a typo fix) still directly sets `statement_balance` with no ledger row — that's a distinct, already-logged action (`update` in the Activity Log shipped earlier tonight), not a payment, and it never touches or rewrites `credit_card_payments` history.
- **No new `AuditAction` enum value.** Recording a payment logs to the existing Activity Log as `action: 'update'`, `entityType: 'credit_card_due'`, with `beforeValue: { statementBalance }` / `afterValue: { statementBalance, amountPaid }` — reuses the taxonomy already shipped tonight instead of migrating the `audit_log` table's `action` check constraint for one new case.
- **Payment method is a free-text field**, not an enum — matches this app's existing style for freeform descriptive fields (income source `name`, bill `category`) rather than inventing a fixed list nobody asked for. Optional, same as notes.
- **Payment date/time (`paid_at`) is user-editable at record time, defaulting to "now."** The request explicitly asks to capture "payment date and time" as a field, which only earns its keep if it can reflect reality (logging a payment made earlier the same day, or backfilling one from a paper receipt) rather than always being "whenever I happened to open the form." A datetime input, defaulting to now, covers this without adding a whole backdating workflow.
- **No special-casing for overpayment.** `balance_after = balance_before - amount`, stored and applied as computed — if a payment exceeds the balance, the result is a negative "remaining balance" (a credit), displayed as-is. Clamping it to zero would silently disagree with the arithmetic the ledger itself records — worse for an audit trail than an honest negative number.
- **No DB-transaction wrapping (Postgres function/RPC) for insert-then-update.** This app already does sequential Supabase calls without wrapping them in a transaction for equivalent two-step mutations (`closeBillCycle` updates the current row, then inserts the next cycle's row, sequentially). Matching that existing precedent is the pragmatic call; introducing the only RPC-wrapped mutation in the codebase for this one feature would be inconsistent for no requirement anyone asked for.

## Architecture

**Schema** (`supabase/migrations/0014_credit_card_payments.sql`):

```sql
create table public.credit_card_payments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.credit_card_dues(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  balance_before numeric(12, 2) not null,
  balance_after numeric(12, 2) not null,
  paid_at timestamptz not null default now(),
  method text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.credit_card_payments enable row level security;

create policy "Authenticated users can view credit card payments"
  on public.credit_card_payments for select to authenticated using (true);
create policy "Authenticated users can insert credit card payments"
  on public.credit_card_payments for insert to authenticated with check (true);

create index credit_card_payments_card_id_idx on public.credit_card_payments(card_id);
create index credit_card_payments_paid_at_idx on public.credit_card_payments(paid_at desc);
```

No `update`/`delete` policy, deliberately — see Decisions above.

**Repository** (`lib/credit-card-payments-repository.ts`):

```
listPaymentsForCard(cardId: string): Promise<CreditCardPayment[]>   // newest paid_at first
recordCardPayment(cardId: string, input: { amount: number; paidAt: string; method?: string | null; notes?: string | null }): Promise<CreditCardPayment>
```

`recordCardPayment` fetches the card's current `statementBalance` as `balanceBefore`, computes `balanceAfter`, inserts the payment row, then updates `credit_card_dues.statement_balance` to `balanceAfter`, then fires `logActivity` (fire-and-forget, same convention as every other mutation wired into the Activity Log tonight).

**Hook** (`lib/use-card-payments.ts`): `{ payments, loading, error, refresh, recordPayment }`, scoped to one `cardId` — same shape as every other list-hook in this app (`useAccounts`, `useCategories`).

**UI**:
- `app/(shell)/accounts/cards/[id]/page.tsx` — reads `id` via `useParams()` (this app's pages are all Client Components; per this Next.js version's own docs, `useParams()` is the client-component way to read a route param, no `await`/Suspense plumbing needed). Finds the card from `useAccounts()`'s `cards` list (reuses the existing fetch — no new single-card repository function). Renders a summary block (remaining balance, total paid, payment count, last payment date, next due date — all computed from `payments` + the card, via a new pure selector module so the numbers are unit-testable independent of any component), a "Record Payment" button opening `RecordPaymentForm`, and `PaymentHistoryList` (newest-first).
- `components/accounts/RecordPaymentForm.tsx` — a `Sheet` dialog, same pattern as `CardDueForm`: amount (required, > 0), method (optional text), notes (optional text), paid-at (datetime, defaults to now).
- `components/accounts/PaymentHistoryList.tsx` / `PaymentHistoryEntry.tsx` — single-column tiles (chronological trail, not grid-friendly — same reasoning as the Activity Log and Budget category cards from tonight's earlier work), each showing date/time, amount, balance before → after, method, notes.
- `components/accounts/CardDueTile.tsx` gains a "View history" link to `/accounts/cards/{id}` at the bottom of the tile — additive, doesn't touch its existing interactive elements (paid-adjacent toggle doesn't exist on this tile; the actions menu trigger is untouched).
- `proxy.ts` needs no change — `/accounts/cards/[id]` already matches the existing `/accounts` entry's `pathname.startsWith('/accounts/')` check.

## Testing

- `lib/credit-card-payments-repository.test.ts` — mocked Supabase client, same convention as every other repository test in this codebase.
- `lib/credit-card-payment-selectors.test.ts` — pure functions (`totalPaid`, `lastPaymentDate`, etc.) over a `CreditCardPayment[]` fixture, no mocking needed.
- `lib/use-card-payments.test.ts` — mirrors `use-accounts.test.ts`'s structure.
- Component tests for `RecordPaymentForm`, `PaymentHistoryList`/`PaymentHistoryEntry`, the new page, and an added assertion to `CardDueTile.test.tsx` for the new link.
- No existing test's assertions change — this is entirely additive (a new table, a new hook, new components, one new link on an existing tile).

## Out of scope

- Editing or deleting a recorded payment (the ledger is append-only by design — a mis-entered payment needs a correcting entry, not a rewrite; not asked for, and would need its own RLS/UX decisions).
- Payment reminders/notifications tied to this feature specifically (the app's existing notification system already covers due-date reminders).
- Multi-currency or interest/fee tracking — out of scope, not requested.
