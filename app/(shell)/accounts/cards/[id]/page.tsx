'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import { useAccounts } from '@/lib/use-accounts';
import { useCardPayments } from '@/lib/use-card-payments';
import { totalPaid, lastPaymentDate, paymentsSinceAnchor, remainingCardBalance } from '@/lib/credit-card-payment-selectors';
import { CardPaymentSummary } from '@/components/accounts/CardPaymentSummary';
import { PaymentHistoryList } from '@/components/accounts/PaymentHistoryList';
import { RecordPaymentForm } from '@/components/accounts/RecordPaymentForm';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { Button } from '@/components/ui/button';
import { useIsMounted } from '@/lib/use-is-mounted';
import type { CreditCardPayment } from '@/lib/credit-card-payments-repository';

export default function CardDetailPage() {
  const params = useParams<{ id: string }>();
  const isMounted = useIsMounted();
  const { cards, loading: cardsLoading } = useAccounts();
  const { payments, loading: paymentsLoading, error, recordPayment, updatePayment, deletePayment } = useCardPayments(params.id);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<CreditCardPayment | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<CreditCardPayment | null>(null);

  const card = cards.find((c) => c.id === params.id);
  const loading = cardsLoading || paymentsLoading;
  const currentCyclePayments = card ? paymentsSinceAnchor(card, payments) : payments;

  function openAddForm() {
    setEditingPayment(undefined);
    setFormOpen(true);
  }

  function openEditForm(payment: CreditCardPayment) {
    setEditingPayment(payment);
    setFormOpen(true);
  }

  async function handleSubmit(input: { amount: number; paidAt: string; method?: string | null; notes?: string | null }) {
    if (editingPayment) {
      await updatePayment(editingPayment.id, input);
    } else {
      await recordPayment(input);
    }
  }

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
            remainingBalance={remainingCardBalance(card, payments)}
            totalPaid={totalPaid(currentCyclePayments)}
            paymentsMade={currentCyclePayments.length}
            lastPaymentDate={lastPaymentDate(currentCyclePayments)}
            nextDueDate={card.dueDate}
          />
          <Button onClick={openAddForm}>
            <Plus className="h-4 w-4" />
            Record Payment
          </Button>
          <PaymentHistoryList payments={payments} onEdit={openEditForm} onDelete={setDeleteTarget} />
          <RecordPaymentForm
            key={`${editingPayment?.id ?? 'new'}-${formOpen}`}
            open={formOpen}
            onOpenChange={setFormOpen}
            initialPayment={editingPayment}
            onSubmit={handleSubmit}
          />
          {deleteTarget && (
            <ConfirmDeleteDialog
              open={!!deleteTarget}
              onOpenChange={(open) => !open && setDeleteTarget(null)}
              title="Delete this payment?"
              description="This can't be undone. The card's remaining balance will be recalculated automatically."
              onConfirm={() => deletePayment(deleteTarget.id)}
            />
          )}
        </>
      )}
    </div>
  );
}
