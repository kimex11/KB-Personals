'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAccounts } from '@/lib/use-accounts';
import { totalIncome } from '@/lib/accounts-selectors';
import { listAllCreditCardPayments, type CreditCardPayment } from '@/lib/credit-card-payments-repository';
import { totalRemainingCardBalance } from '@/lib/credit-card-payment-selectors';
import { AccountsSummary } from '@/components/accounts/AccountsSummary';
import { CardDueTile } from '@/components/accounts/CardDueTile';
import { IncomeTile } from '@/components/accounts/IncomeTile';
import { TileGrid } from '@/components/shared/TileGrid';
import { CardDueForm } from '@/components/accounts/CardDueForm';
import { IncomeForm } from '@/components/accounts/IncomeForm';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { useIsMounted } from '@/lib/use-is-mounted';
import type { CreditCardDue, IncomeSource } from '@/lib/accounts-types';

export default function AccountsPage() {
  const isMounted = useIsMounted();
  const { cards, incomeSources, loading, error, createCard, updateCard, deleteCard, createIncome, updateIncome, deleteIncome } =
    useAccounts();

  const [cardFormOpen, setCardFormOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCardDue | undefined>(undefined);
  const [deleteCardTarget, setDeleteCardTarget] = useState<CreditCardDue | null>(null);

  const [incomeFormOpen, setIncomeFormOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeSource | undefined>(undefined);
  const [deleteIncomeTarget, setDeleteIncomeTarget] = useState<IncomeSource | null>(null);

  const [cardPayments, setCardPayments] = useState<CreditCardPayment[]>([]);
  useEffect(() => {
    listAllCreditCardPayments().then(setCardPayments).catch(() => {});
  }, []);
  const paymentsByCardId = cardPayments.reduce<Record<string, CreditCardPayment[]>>((acc, payment) => {
    (acc[payment.cardId] ??= []).push(payment);
    return acc;
  }, {});

  const totalDue = totalRemainingCardBalance(cards, paymentsByCardId);
  const income = totalIncome(incomeSources);

  function openAddCard() {
    setEditingCard(undefined);
    setCardFormOpen(true);
  }

  function openEditCard(card: CreditCardDue) {
    setEditingCard(card);
    setCardFormOpen(true);
  }

  async function handleCardSubmit(input: { cardName: string; last4: string; statementBalance: number; minimumPayment: number; dueDate: string }) {
    if (editingCard) {
      await updateCard(editingCard.id, input);
    } else {
      await createCard(input);
    }
  }

  function openAddIncome() {
    setEditingIncome(undefined);
    setIncomeFormOpen(true);
  }

  function openEditIncome(source: IncomeSource) {
    setEditingIncome(source);
    setIncomeFormOpen(true);
  }

  async function handleIncomeSubmit(input: { name: string; amount: number; date: string }) {
    if (editingIncome) {
      await updateIncome(editingIncome.id, input);
    } else {
      await createIncome(input);
    }
  }

  return (
    <div data-testid="accounts-page" className="flex flex-col gap-6 px-4 pb-24 pt-4">
      {isMounted && loading && (
        <p data-testid="accounts-loading" className="text-center text-sm text-neutral-400">
          Loading accounts…
        </p>
      )}
      {isMounted && !loading && (
        <>
          {error && <p className="text-sm text-status-critical">{error}</p>}
          <AccountsSummary totalDue={totalDue} totalIncome={income} />
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg text-neutral-900">Credit Card Dues</h2>
              <Button size="sm" onClick={openAddCard}>
                <Plus className="h-4 w-4" />
                Add Card
              </Button>
            </div>
            {cards.length === 0 ? (
              <EmptyState message="No credit cards yet." />
            ) : (
              <TileGrid testId="accounts-card-tile-grid">
                {cards.map((card) => (
                  <CardDueTile
                    key={card.id}
                    card={card}
                    payments={paymentsByCardId[card.id] ?? []}
                    referenceDate={new Date()}
                    onEdit={openEditCard}
                    onDelete={setDeleteCardTarget}
                  />
                ))}
              </TileGrid>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg text-neutral-900">Income</h2>
              <Button size="sm" onClick={openAddIncome}>
                <Plus className="h-4 w-4" />
                Add Income
              </Button>
            </div>
            {incomeSources.length === 0 ? (
              <EmptyState message="No income sources yet." />
            ) : (
              <TileGrid testId="accounts-income-tile-grid">
                {incomeSources.map((source) => (
                  <IncomeTile
                    key={source.id}
                    source={source}
                    referenceDate={new Date()}
                    onEdit={openEditIncome}
                    onDelete={setDeleteIncomeTarget}
                  />
                ))}
              </TileGrid>
            )}
          </div>
        </>
      )}

      <CardDueForm
        key={`card-${editingCard?.id ?? 'new'}-${cardFormOpen}`}
        open={cardFormOpen}
        onOpenChange={setCardFormOpen}
        initialCard={editingCard}
        onSubmit={handleCardSubmit}
      />
      {deleteCardTarget && (
        <ConfirmDeleteDialog
          open={!!deleteCardTarget}
          onOpenChange={(open) => !open && setDeleteCardTarget(null)}
          title={`Delete ${deleteCardTarget.cardName}?`}
          description="This can't be undone."
          onConfirm={() => deleteCard(deleteCardTarget.id)}
        />
      )}

      <IncomeForm
        key={`income-${editingIncome?.id ?? 'new'}-${incomeFormOpen}`}
        open={incomeFormOpen}
        onOpenChange={setIncomeFormOpen}
        initialIncome={editingIncome}
        onSubmit={handleIncomeSubmit}
      />
      {deleteIncomeTarget && (
        <ConfirmDeleteDialog
          open={!!deleteIncomeTarget}
          onOpenChange={(open) => !open && setDeleteIncomeTarget(null)}
          title={`Delete ${deleteIncomeTarget.name}?`}
          description="This can't be undone."
          onConfirm={() => deleteIncome(deleteIncomeTarget.id)}
        />
      )}
    </div>
  );
}
