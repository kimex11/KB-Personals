'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Settings } from 'lucide-react';
import { useExpenses } from '@/lib/use-expenses';
import { useCategories } from '@/lib/use-categories';
import { useBills } from '@/lib/use-bills';
import { listAllCreditCardPayments, type CreditCardPayment } from '@/lib/credit-card-payments-repository';
import { totalExpenses } from '@/lib/expenses-selectors';
import { totalPaidBills } from '@/lib/bills-selectors';
import { totalPaid as totalRepayments } from '@/lib/credit-card-payment-selectors';
import { ExpensesSummary } from '@/components/expenses/ExpensesSummary';
import { PaymentsRepaymentsSummary } from '@/components/expenses/PaymentsRepaymentsSummary';
import { ExpensesList } from '@/components/expenses/ExpensesList';
import { ExpenseForm } from '@/components/expenses/ExpenseForm';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { Button } from '@/components/ui/button';
import { useIsMounted } from '@/lib/use-is-mounted';
import type { Expense } from '@/lib/expenses-repository';

export default function BudgetPage() {
  const isMounted = useIsMounted();
  const { expenses, loading: expensesLoading, error: expensesError, create, update, remove } = useExpenses();
  const { activeCategories, loading: categoriesLoading } = useCategories();
  const { bills } = useBills();
  const [cardPayments, setCardPayments] = useState<CreditCardPayment[]>([]);

  useEffect(() => {
    listAllCreditCardPayments().then(setCardPayments).catch(() => {});
  }, []);

  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const loading = expensesLoading || categoriesLoading;

  function openAddForm() {
    setEditingExpense(undefined);
    setFormOpen(true);
  }

  function openEditForm(expense: Expense) {
    setEditingExpense(expense);
    setFormOpen(true);
  }

  async function handleSubmit(input: { categoryId: string; amount: number; date: string; description?: string | null; paymentMethod?: string | null }) {
    if (editingExpense) {
      await update(editingExpense.id, input);
    } else {
      await create(input);
    }
  }

  return (
    <div data-testid="budget-page" className="flex flex-col gap-6 px-4 pb-24 pt-4">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-xl text-neutral-900">Expenses</h1>
        <div className="flex items-center gap-2">
          <Link href="/budget/categories" aria-label="Manage Categories" className="text-neutral-500">
            <Settings className="h-5 w-5" />
          </Link>
          <Button size="sm" onClick={openAddForm}>
            <Plus className="h-4 w-4" />
            Add Expense
          </Button>
        </div>
      </div>
      {expensesError && <p className="text-sm text-status-critical">{expensesError}</p>}
      {isMounted && loading && (
        <p data-testid="budget-loading" className="text-center text-sm text-neutral-400">
          Loading…
        </p>
      )}
      {isMounted && !loading && (
        <>
          <ExpensesSummary total={totalExpenses(expenses)} count={expenses.length} />
          <PaymentsRepaymentsSummary
            billsPaidTotal={totalPaidBills(bills)}
            billsPaidCount={bills.filter((bill) => bill.paid).length}
            repaymentsTotal={totalRepayments(cardPayments)}
            repaymentsCount={cardPayments.length}
          />
          <ExpensesList expenses={expenses} categories={activeCategories} onEdit={openEditForm} onDelete={setDeleteTarget} />
        </>
      )}

      <ExpenseForm
        key={`${editingExpense?.id ?? 'new'}-${formOpen}`}
        open={formOpen}
        onOpenChange={setFormOpen}
        categories={activeCategories}
        initialExpense={editingExpense}
        onSubmit={handleSubmit}
      />
      {deleteTarget && (
        <ConfirmDeleteDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title="Delete this expense?"
          description="This can't be undone."
          onConfirm={() => remove(deleteTarget.id)}
        />
      )}
    </div>
  );
}
