# Credit Card Payment History — Phase 2 (UI: form, history, summary, page) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the card detail page, `/accounts/cards/[id]` — the first dynamic route in this app — with a payment summary, a "Record Payment" form, and the full payment history trail, reachable via a new "View history" link on each `CardDueTile`.

**Architecture:** `RecordPaymentForm` mirrors `CardDueForm`'s existing `Sheet`-dialog shape. `PaymentHistoryEntry`/`PaymentHistoryList` mirror `ActivityLogEntryTile`/`ActivityLogList`'s single-column chronological-tile shape (shipped earlier tonight) — a payment trail reads top-to-bottom by time, not grid-friendly. `CardPaymentSummary` mirrors `AccountsSummary`'s stat-row shape. The page itself is a Client Component reading its route param via `useParams()` (per this Next.js version's own docs — the client-component way to read dynamic segments, no `await`/Suspense plumbing needed) and finds its card from `useAccounts()`'s already-fetched `cards` list rather than adding a new single-card fetch function. `proxy.ts` needs no change — `/accounts/cards/[id]` already matches the existing `/accounts` entry's `startsWith('/accounts/')` check.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Next.js 16 App Router, vitest + @testing-library/react + @testing-library/user-event, date-fns.

## Global Constraints

- No change to `proxy.ts` — verify this, don't just assume it (Task 4, Step 5).
- `RecordPaymentForm`'s "Paid on" field defaults to the current local datetime but is editable — per the spec's decision to let a recorded payment reflect when it actually happened, not just when the form was opened.
- Every new tappable single-purpose control (the "View history" link, the "Record Payment" button) meets this app's established 44px touch-target minimum (`min-h-11`).

---

### Task 1: `RecordPaymentForm` component

**Files:**
- Create: `components/accounts/RecordPaymentForm.tsx`
- Create: `components/accounts/RecordPaymentForm.test.tsx`

**Interfaces:**
- Consumes: `RecordCardPaymentInput` from `@/lib/credit-card-payments-repository` (Phase 1).
- Produces: `RecordPaymentForm({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; onSubmit: (input: RecordCardPaymentInput) => Promise<void>; })` — consumed by the card detail page (Task 4).

- [ ] **Step 1: Write the failing test**

Create `components/accounts/RecordPaymentForm.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecordPaymentForm } from './RecordPaymentForm';

describe('RecordPaymentForm', () => {
  it('renders empty amount/method/notes fields and a heading', () => {
    render(<RecordPaymentForm open onOpenChange={() => {}} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/amount/i)).toHaveValue(null);
    expect(screen.getByLabelText(/payment method/i)).toHaveValue('');
    expect(screen.getByLabelText(/notes/i)).toHaveValue('');
    expect(screen.getByRole('heading', { name: /record payment/i })).toBeInTheDocument();
  });

  it('disables the submit button until a positive amount and a paid-on date are set', async () => {
    const user = userEvent.setup();
    render(<RecordPaymentForm open onOpenChange={() => {}} onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^record payment$/i })).toBeDisabled();

    await user.type(screen.getByLabelText(/amount/i), '300');
    expect(screen.getByRole('button', { name: /^record payment$/i })).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText(/paid on/i), { target: { value: '' } });
    expect(screen.getByRole('button', { name: /^record payment$/i })).toBeDisabled();
  });

  it('rejects a zero or negative amount', async () => {
    const user = userEvent.setup();
    render(<RecordPaymentForm open onOpenChange={() => {}} onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/amount/i), '0');
    expect(screen.getByRole('button', { name: /record payment/i })).toBeDisabled();
  });

  it('calls onSubmit with the entered values, converting the paid-on field to an ISO string', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<RecordPaymentForm open onOpenChange={() => {}} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/amount/i), '300');
    fireEvent.change(screen.getByLabelText(/paid on/i), { target: { value: '2026-08-10T10:00' } });
    await user.type(screen.getByLabelText(/payment method/i), 'Bank transfer');
    await user.type(screen.getByLabelText(/notes/i), 'Paid from savings');
    await user.click(screen.getByRole('button', { name: /record payment/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      amount: 300,
      paidAt: new Date('2026-08-10T10:00').toISOString(),
      method: 'Bank transfer',
      notes: 'Paid from savings',
    });
  });

  it('sends null for method and notes when left blank', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<RecordPaymentForm open onOpenChange={() => {}} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/amount/i), '150');
    fireEvent.change(screen.getByLabelText(/paid on/i), { target: { value: '2026-08-10T10:00' } });
    await user.click(screen.getByRole('button', { name: /record payment/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 150, method: null, notes: null })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/accounts/RecordPaymentForm.test.tsx`
Expected: FAIL — `Cannot find module './RecordPaymentForm'`

- [ ] **Step 3: Write the implementation**

Create `components/accounts/RecordPaymentForm.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { RecordCardPaymentInput } from '@/lib/credit-card-payments-repository';

interface RecordPaymentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: RecordCardPaymentInput) => Promise<void>;
}

function nowLocalDatetimeValue(): string {
  return format(new Date(), "yyyy-MM-dd'T'HH:mm");
}

export function RecordPaymentForm({ open, onOpenChange, onSubmit }: RecordPaymentFormProps) {
  const [amount, setAmount] = useState('');
  const [paidAtLocal, setPaidAtLocal] = useState(nowLocalDatetimeValue);
  const [method, setMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isValid = amount !== '' && !Number.isNaN(Number(amount)) && Number(amount) > 0 && paidAtLocal !== '';

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmit({
        amount: Number(amount),
        paidAt: new Date(paidAtLocal).toISOString(),
        method: method.trim() === '' ? null : method.trim(),
        notes: notes.trim() === '' ? null : notes.trim(),
      });
      setAmount('');
      setPaidAtLocal(nowLocalDatetimeValue());
      setMethod('');
      setNotes('');
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Record payment</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-amount">Amount</Label>
            <Input id="payment-amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-paid-at">Paid on</Label>
            <Input id="payment-paid-at" type="datetime-local" value={paidAtLocal} onChange={(e) => setPaidAtLocal(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-method">Payment method (optional)</Label>
            <Input id="payment-method" value={method} onChange={(e) => setMethod(e.target.value)} placeholder="e.g. Bank transfer" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-notes">Notes (optional)</Label>
            <Input id="payment-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <SheetFooter>
          <Button onClick={handleSubmit} disabled={!isValid || submitting}>
            {submitting ? 'Saving…' : 'Record payment'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/accounts/RecordPaymentForm.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add components/accounts/RecordPaymentForm.tsx components/accounts/RecordPaymentForm.test.tsx
git commit -m "feat: add RecordPaymentForm component"
```

---

### Task 2: `PaymentHistoryEntry` and `PaymentHistoryList` components

**Files:**
- Create: `components/accounts/PaymentHistoryEntry.tsx`
- Create: `components/accounts/PaymentHistoryEntry.test.tsx`
- Create: `components/accounts/PaymentHistoryList.tsx`
- Create: `components/accounts/PaymentHistoryList.test.tsx`

**Interfaces:**
- Consumes: `CreditCardPayment` from `@/lib/credit-card-payments-repository` (Phase 1); `EmptyState` from `@/components/shared/EmptyState`.
- Produces: `PaymentHistoryEntry({ payment: CreditCardPayment })`, `PaymentHistoryList({ payments: CreditCardPayment[] })` — consumed by the card detail page (Task 4).

- [ ] **Step 1: Write the failing test for `PaymentHistoryEntry`**

Create `components/accounts/PaymentHistoryEntry.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaymentHistoryEntry } from './PaymentHistoryEntry';
import type { CreditCardPayment } from '@/lib/credit-card-payments-repository';

const payment: CreditCardPayment = {
  id: 'pay-1', cardId: 'card-1', amount: 300, balanceBefore: 842.5, balanceAfter: 542.5, paidAt: '2026-08-10T10:00:00.000Z', method: 'Bank transfer', notes: 'Paid from savings',
};

describe('PaymentHistoryEntry', () => {
  it('shows the amount, balance trail, and timestamp', () => {
    render(<PaymentHistoryEntry payment={payment} />);
    const entry = screen.getByTestId('payment-history-entry');
    expect(entry).toHaveTextContent('300.00');
    expect(screen.getByTestId('payment-balance-trail')).toHaveTextContent('842.50');
    expect(screen.getByTestId('payment-balance-trail')).toHaveTextContent('542.50');
  });

  it('shows method and notes when present', () => {
    render(<PaymentHistoryEntry payment={payment} />);
    expect(screen.getByText('Bank transfer')).toBeInTheDocument();
    expect(screen.getByTestId('payment-notes')).toHaveTextContent('Paid from savings');
  });

  it('omits notes when absent', () => {
    render(<PaymentHistoryEntry payment={{ ...payment, notes: null }} />);
    expect(screen.queryByTestId('payment-notes')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/accounts/PaymentHistoryEntry.test.tsx`
Expected: FAIL — `Cannot find module './PaymentHistoryEntry'`

- [ ] **Step 3: Write the `PaymentHistoryEntry` implementation**

Create `components/accounts/PaymentHistoryEntry.tsx`:

```tsx
import { format, parseISO } from 'date-fns';
import type { CreditCardPayment } from '@/lib/credit-card-payments-repository';

export function PaymentHistoryEntry({ payment }: { payment: CreditCardPayment }) {
  return (
    <div data-testid="payment-history-entry" className="flex flex-col gap-1 rounded-2xl bg-status-success/10 p-4">
      <div className="flex items-center justify-between">
        <span className="font-serif text-sm text-status-success">-₱{payment.amount.toFixed(2)}</span>
        <span className="text-xs text-neutral-500">{format(parseISO(payment.paidAt), "MMM d, yyyy 'at' h:mm a")}</span>
      </div>
      <p data-testid="payment-balance-trail" className="text-xs text-neutral-500">
        ₱{payment.balanceBefore.toFixed(2)} → ₱{payment.balanceAfter.toFixed(2)}
      </p>
      {payment.method && <p className="text-xs text-neutral-500">{payment.method}</p>}
      {payment.notes && (
        <p data-testid="payment-notes" className="text-xs text-neutral-400">
          {payment.notes}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/accounts/PaymentHistoryEntry.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the failing test for `PaymentHistoryList`**

Create `components/accounts/PaymentHistoryList.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaymentHistoryList } from './PaymentHistoryList';
import type { CreditCardPayment } from '@/lib/credit-card-payments-repository';

const payments: CreditCardPayment[] = [
  { id: 'pay-2', cardId: 'card-1', amount: 300, balanceBefore: 542.5, balanceAfter: 242.5, paidAt: '2026-08-10T10:00:00.000Z', method: null, notes: null },
  { id: 'pay-1', cardId: 'card-1', amount: 400, balanceBefore: 942.5, balanceAfter: 542.5, paidAt: '2026-07-28T09:00:00.000Z', method: null, notes: null },
];

describe('PaymentHistoryList', () => {
  it('shows an empty state when there are no payments', () => {
    render(<PaymentHistoryList payments={[]} />);
    expect(screen.getByTestId('empty-state')).toHaveTextContent('No payments recorded yet.');
  });

  it('renders one entry per payment, in the order given', () => {
    render(<PaymentHistoryList payments={payments} />);
    const entries = screen.getAllByTestId('payment-history-entry');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent('300.00');
    expect(entries[1]).toHaveTextContent('400.00');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run components/accounts/PaymentHistoryList.test.tsx`
Expected: FAIL — `Cannot find module './PaymentHistoryList'`

- [ ] **Step 7: Write the `PaymentHistoryList` implementation**

Create `components/accounts/PaymentHistoryList.tsx`:

```tsx
import type { CreditCardPayment } from '@/lib/credit-card-payments-repository';
import { PaymentHistoryEntry } from './PaymentHistoryEntry';
import { EmptyState } from '@/components/shared/EmptyState';

export function PaymentHistoryList({ payments }: { payments: CreditCardPayment[] }) {
  if (payments.length === 0) {
    return <EmptyState message="No payments recorded yet." />;
  }

  return (
    <div data-testid="payment-history-list" className="flex flex-col gap-2">
      {payments.map((payment) => (
        <PaymentHistoryEntry key={payment.id} payment={payment} />
      ))}
    </div>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run components/accounts/PaymentHistoryList.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 9: Commit**

```bash
git add components/accounts/PaymentHistoryEntry.tsx components/accounts/PaymentHistoryEntry.test.tsx components/accounts/PaymentHistoryList.tsx components/accounts/PaymentHistoryList.test.tsx
git commit -m "feat: add PaymentHistoryEntry and PaymentHistoryList components"
```

---

### Task 3: `CardPaymentSummary` component

**Files:**
- Create: `components/accounts/CardPaymentSummary.tsx`
- Create: `components/accounts/CardPaymentSummary.test.tsx`

**Interfaces:**
- Produces: `CardPaymentSummary({ remainingBalance, totalPaid, paymentsMade, lastPaymentDate, nextDueDate }: { remainingBalance: number; totalPaid: number; paymentsMade: number; lastPaymentDate: string | null; nextDueDate: string; })` — consumed by the card detail page (Task 4).

- [ ] **Step 1: Write the failing test**

Create `components/accounts/CardPaymentSummary.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardPaymentSummary } from './CardPaymentSummary';

describe('CardPaymentSummary', () => {
  it('shows remaining balance, total paid, and payment count', () => {
    render(
      <CardPaymentSummary
        remainingBalance={542.5}
        totalPaid={700}
        paymentsMade={2}
        lastPaymentDate="2026-08-10T10:00:00.000Z"
        nextDueDate="2026-08-16"
      />
    );
    expect(screen.getByTestId('summary-remaining-balance')).toHaveTextContent('542.50');
    expect(screen.getByTestId('summary-total-paid')).toHaveTextContent('700.00');
    expect(screen.getByTestId('summary-payments-made')).toHaveTextContent('2');
  });

  it('formats the last payment date and next due date', () => {
    render(
      <CardPaymentSummary
        remainingBalance={542.5}
        totalPaid={700}
        paymentsMade={2}
        lastPaymentDate="2026-08-10T10:00:00.000Z"
        nextDueDate="2026-08-16"
      />
    );
    expect(screen.getByTestId('summary-last-payment')).toHaveTextContent('Aug 10, 2026');
    expect(screen.getByTestId('summary-next-due-date')).toHaveTextContent('Aug 16, 2026');
  });

  it('shows a placeholder when there is no last payment yet', () => {
    render(
      <CardPaymentSummary
        remainingBalance={842.5}
        totalPaid={0}
        paymentsMade={0}
        lastPaymentDate={null}
        nextDueDate="2026-08-16"
      />
    );
    expect(screen.getByTestId('summary-last-payment')).toHaveTextContent('No payments yet');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/accounts/CardPaymentSummary.test.tsx`
Expected: FAIL — `Cannot find module './CardPaymentSummary'`

- [ ] **Step 3: Write the implementation**

Create `components/accounts/CardPaymentSummary.tsx`:

```tsx
import { format, parseISO } from 'date-fns';

interface CardPaymentSummaryProps {
  remainingBalance: number;
  totalPaid: number;
  paymentsMade: number;
  lastPaymentDate: string | null;
  nextDueDate: string;
}

export function CardPaymentSummary({ remainingBalance, totalPaid, paymentsMade, lastPaymentDate, nextDueDate }: CardPaymentSummaryProps) {
  return (
    <div data-testid="card-payment-summary" className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500">Remaining Balance</span>
        <span data-testid="summary-remaining-balance" className="font-serif text-sm text-neutral-900">
          ₱{remainingBalance.toFixed(2)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500">Total Paid</span>
        <span data-testid="summary-total-paid" className="font-serif text-sm text-status-success">
          ₱{totalPaid.toFixed(2)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500">Payments Made</span>
        <span data-testid="summary-payments-made" className="font-serif text-sm text-neutral-900">
          {paymentsMade}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500">Last Payment</span>
        <span data-testid="summary-last-payment" className="text-xs text-neutral-700">
          {lastPaymentDate ? format(parseISO(lastPaymentDate), 'MMM d, yyyy') : 'No payments yet'}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500">Next Due Date</span>
        <span data-testid="summary-next-due-date" className="text-xs text-neutral-700">
          {format(parseISO(nextDueDate), 'MMM d, yyyy')}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/accounts/CardPaymentSummary.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add components/accounts/CardPaymentSummary.tsx components/accounts/CardPaymentSummary.test.tsx
git commit -m "feat: add CardPaymentSummary component"
```

---

### Task 4: Card detail page

**Files:**
- Create: `app/(shell)/accounts/cards/[id]/page.tsx`
- Create: `app/(shell)/accounts/cards/[id]/page.test.tsx`

**Interfaces:**
- Consumes: `useAccounts` from `@/lib/use-accounts`; `useCardPayments` from `@/lib/use-card-payments` (Phase 1); `totalPaid`, `lastPaymentDate` from `@/lib/credit-card-payment-selectors` (Phase 1); `CardPaymentSummary` (Task 3), `PaymentHistoryList` (Task 2), `RecordPaymentForm` (Task 1); `useIsMounted` from `@/lib/use-is-mounted` (existing).

- [ ] **Step 1: Write the failing test**

Create `app/(shell)/accounts/cards/[id]/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CardDetailPage from './page';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'card-1' }),
}));

const card = { id: 'card-1', cardName: 'Visa Platinum', last4: '4821', statementBalance: 542.5, minimumPayment: 45, dueDate: '2026-08-16' };

const { useAccountsMock, useCardPaymentsMock, recordPaymentMock } = vi.hoisted(() => ({
  useAccountsMock: vi.fn(),
  useCardPaymentsMock: vi.fn(),
  recordPaymentMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/use-accounts', () => ({ useAccounts: useAccountsMock }));
vi.mock('@/lib/use-card-payments', () => ({ useCardPayments: useCardPaymentsMock }));

const payment = { id: 'pay-1', cardId: 'card-1', amount: 300, balanceBefore: 842.5, balanceAfter: 542.5, paidAt: '2026-08-10T10:00:00.000Z', method: 'Bank transfer', notes: null };

describe('CardDetailPage', () => {
  it('shows the card name, summary, and payment history', async () => {
    useAccountsMock.mockReturnValue({ cards: [card], incomeSources: [], loading: false, error: null });
    useCardPaymentsMock.mockReturnValue({ payments: [payment], loading: false, error: null, recordPayment: recordPaymentMock });

    render(<CardDetailPage />);

    expect(screen.getByText('Visa Platinum')).toBeInTheDocument();
    expect(screen.getByTestId('card-payment-summary')).toBeInTheDocument();
    expect(screen.getByTestId('payment-history-entry')).toBeInTheDocument();
  });

  it('shows a not-found message when no card matches the route id', async () => {
    useAccountsMock.mockReturnValue({ cards: [], incomeSources: [], loading: false, error: null });
    useCardPaymentsMock.mockReturnValue({ payments: [], loading: false, error: null, recordPayment: recordPaymentMock });

    render(<CardDetailPage />);

    expect(screen.getByTestId('card-not-found')).toBeInTheDocument();
  });

  it('opens the Record Payment form and submits through the hook', async () => {
    useAccountsMock.mockReturnValue({ cards: [card], incomeSources: [], loading: false, error: null });
    useCardPaymentsMock.mockReturnValue({ payments: [], loading: false, error: null, recordPayment: recordPaymentMock });
    const user = userEvent.setup();

    render(<CardDetailPage />);
    await user.click(screen.getByRole('button', { name: /record payment/i }));
    await user.type(screen.getByLabelText(/^amount$/i), '150');
    await user.click(screen.getByRole('button', { name: /^record payment$/i }));

    await waitFor(() => expect(recordPaymentMock).toHaveBeenCalledWith(expect.objectContaining({ amount: 150 })));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/(shell)/accounts/cards/[id]/page.test.tsx"`
Expected: FAIL — `Cannot find module './page'`

- [ ] **Step 3: Write the implementation**

Create `app/(shell)/accounts/cards/[id]/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import { useAccounts } from '@/lib/use-accounts';
import { useCardPayments } from '@/lib/use-card-payments';
import { totalPaid, lastPaymentDate } from '@/lib/credit-card-payment-selectors';
import { CardPaymentSummary } from '@/components/accounts/CardPaymentSummary';
import { PaymentHistoryList } from '@/components/accounts/PaymentHistoryList';
import { RecordPaymentForm } from '@/components/accounts/RecordPaymentForm';
import { Button } from '@/components/ui/button';
import { useIsMounted } from '@/lib/use-is-mounted';

export default function CardDetailPage() {
  const params = useParams<{ id: string }>();
  const isMounted = useIsMounted();
  const { cards, loading: cardsLoading } = useAccounts();
  const { payments, loading: paymentsLoading, error, recordPayment } = useCardPayments(params.id);
  const [formOpen, setFormOpen] = useState(false);

  const card = cards.find((c) => c.id === params.id);
  const loading = cardsLoading || paymentsLoading;

  return (
    <div data-testid="card-detail-page" className="flex flex-col gap-4 px-4 pb-24 pt-4">
      <div className="flex items-center gap-2">
        <Link href="/accounts" aria-label="Back to Accounts">
          <Button variant="ghost" size="icon-sm" className="min-h-11 min-w-11">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-medium text-neutral-900">{card?.cardName ?? 'Card'}</h1>
      </div>

      {error && <p className="text-sm text-status-critical">{error}</p>}

      {isMounted && loading && (
        <p data-testid="card-detail-loading" className="text-center text-sm text-neutral-400">
          Loading…
        </p>
      )}

      {isMounted && !loading && !card && (
        <p data-testid="card-not-found" className="text-center text-sm text-neutral-400">
          Card not found.
        </p>
      )}

      {isMounted && !loading && card && (
        <>
          <CardPaymentSummary
            remainingBalance={card.statementBalance}
            totalPaid={totalPaid(payments)}
            paymentsMade={payments.length}
            lastPaymentDate={lastPaymentDate(payments)}
            nextDueDate={card.dueDate}
          />
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Record Payment
          </Button>
          <PaymentHistoryList payments={payments} />
          <RecordPaymentForm open={formOpen} onOpenChange={setFormOpen} onSubmit={recordPayment} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "app/(shell)/accounts/cards/[id]/page.test.tsx"`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add "app/(shell)/accounts/cards/"
git commit -m "feat: add the credit card detail page"
```

---

### Task 5: "View history" link on `CardDueTile`

**Files:**
- Modify: `components/accounts/CardDueTile.tsx`
- Modify: `components/accounts/CardDueTile.test.tsx`

**Interfaces:**
- No new props — `card.id` (already on the existing `card` prop) drives the link's `href`.

- [ ] **Step 1: Write the failing test**

In `components/accounts/CardDueTile.test.tsx`, add:

```tsx
  it('links to the card detail page', () => {
    render(<CardDueTile card={card} referenceDate={referenceDate} />);
    expect(screen.getByTestId('card-view-history-link')).toHaveAttribute('href', '/accounts/cards/1');
  });
```

(add inside the existing `describe('CardDueTile', ...)` block, alongside the other tests — the fixture card's `id` is `'1'`)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/accounts/CardDueTile.test.tsx`
Expected: FAIL — no element found with testid `card-view-history-link`

- [ ] **Step 3: Update the implementation**

In `components/accounts/CardDueTile.tsx`, add the import:

```tsx
import Link from 'next/link';
```

(alongside the existing imports)

Add the link after the existing balance/badge row, inside the same root `<div>`:

```tsx
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span data-testid="card-due-balance" className={`font-serif text-sm ${STATUS_BALANCE_COLOR[status]}`}>
            ₱{card.statementBalance.toFixed(2)}
          </span>
          <span className="text-[10px] text-neutral-400">Min ₱{card.minimumPayment.toFixed(2)}</span>
        </div>
        <CardDueStatusBadge status={status} />
      </div>
      <Link
        href={`/accounts/cards/${card.id}`}
        data-testid="card-view-history-link"
        className="flex min-h-11 items-center justify-center rounded-full border border-neutral-200 text-xs font-medium text-neutral-600"
      >
        View history
      </Link>
```

(the balance/badge `<div>` block is unchanged; only the new `<Link>` is added right after it, still inside the tile's root `<div>`)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/accounts/CardDueTile.test.tsx`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add components/accounts/CardDueTile.tsx components/accounts/CardDueTile.test.tsx
git commit -m "feat: link CardDueTile to its payment history page"
```

---

### Task 6: Full suite verification

**Files:** None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All test files pass.

- [ ] **Step 2: Run the TypeScript compiler**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Run the linter**

Run: `npx eslint .`
Expected: No errors.

- [ ] **Step 4: Run the production build**

Run: `npx next build`
Expected: Build succeeds, and the route list includes a dynamic `/accounts/cards/[id]` entry.

- [ ] **Step 5: Confirm `proxy.ts` needs no change**

Run: `npx vitest run proxy.test.ts`
Expected: PASS (unchanged) — confirms `/accounts/cards/[id]` is already covered by the existing `/accounts` protected-path prefix match, per this plan's Architecture note.

- [ ] **Step 6: Manual smoke check (note only)**

Not executable in this environment — flag to the user: after migration `0014_credit_card_payments.sql` is applied, open `/accounts`, tap "View history" on a card, record a payment, and confirm the summary (remaining balance, total paid, payment count, last payment, next due date) and the history list both update correctly, newest payment first.
