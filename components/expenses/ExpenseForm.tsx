'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/shared/CurrencyInput';
import { DOT_COLOR_CLASS } from '@/lib/category-colors';
import type { CreateExpenseInput, Expense } from '@/lib/expenses-repository';

interface ExpenseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: { id: string; name: string; colorSlot?: number }[];
  initialExpense?: Expense;
  onSubmit: (input: CreateExpenseInput) => Promise<void>;
}

export function ExpenseForm({ open, onOpenChange, categories, initialExpense, onSubmit }: ExpenseFormProps) {
  const [categoryId, setCategoryId] = useState(initialExpense?.categoryId ?? categories[0]?.id ?? '');
  const [amount, setAmount] = useState(initialExpense?.amount?.toString() ?? '');
  const [date, setDate] = useState(initialExpense?.date ?? format(new Date(), 'yyyy-MM-dd'));
  const [description, setDescription] = useState(initialExpense?.description ?? '');
  const [paymentMethod, setPaymentMethod] = useState(initialExpense?.paymentMethod ?? '');
  const [submitting, setSubmitting] = useState(false);

  const selectedCategoryColorSlot = categories.find((category) => category.id === categoryId)?.colorSlot;

  const isValid = categoryId !== '' && amount !== '' && !Number.isNaN(Number(amount)) && Number(amount) > 0 && date !== '';

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmit({
        categoryId,
        amount: Number(amount),
        date,
        description: description.trim() === '' ? null : description.trim(),
        paymentMethod: paymentMethod.trim() === '' ? null : paymentMethod.trim(),
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>{initialExpense ? 'Edit expense' : 'Add expense'}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expense-category">Category</Label>
            <div className="relative">
              <span
                data-testid="expense-category-select-swatch"
                aria-hidden="true"
                className={`pointer-events-none absolute left-2.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ${
                  selectedCategoryColorSlot ? DOT_COLOR_CLASS[selectedCategoryColorSlot] : 'bg-neutral-300'
                }`}
              />
              <select
                id="expense-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="min-h-11 w-full rounded-lg border border-neutral-200 pl-7 pr-2 text-sm text-neutral-900"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expense-amount">Amount</Label>
            <CurrencyInput id="expense-amount" value={amount} onChange={setAmount} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expense-date">Date</Label>
            <Input id="expense-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expense-description">Description (optional)</Label>
            <Input id="expense-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Weekly grocery run" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expense-payment-method">Payment method (optional)</Label>
            <Input id="expense-payment-method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="e.g. Cash" />
          </div>
        </div>
        <SheetFooter>
          <Button onClick={handleSubmit} disabled={!isValid || submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
