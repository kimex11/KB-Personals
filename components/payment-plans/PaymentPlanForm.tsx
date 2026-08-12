'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/shared/CurrencyInput';
import type { CreatePaymentPlanInput } from '@/lib/payment-plans-repository';

interface PaymentPlanFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: { id: string; name: string }[];
  onSubmit: (input: CreatePaymentPlanInput) => Promise<void>;
}

export function PaymentPlanForm({ open, onOpenChange, categories, onSubmit }: PaymentPlanFormProps) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [totalAmount, setTotalAmount] = useState('');
  const [installmentCount, setInstallmentCount] = useState('');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [submitting, setSubmitting] = useState(false);

  const isValid =
    name.trim() !== '' &&
    categoryId !== '' &&
    totalAmount !== '' &&
    !Number.isNaN(Number(totalAmount)) &&
    Number(totalAmount) > 0 &&
    installmentCount !== '' &&
    !Number.isNaN(Number(installmentCount)) &&
    Number(installmentCount) > 0 &&
    monthlyAmount !== '' &&
    !Number.isNaN(Number(monthlyAmount)) &&
    Number(monthlyAmount) > 0 &&
    startDate !== '';

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        categoryId,
        totalAmount: Number(totalAmount),
        installmentCount: Number(installmentCount),
        monthlyAmount: Number(monthlyAmount),
        startDate,
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
          <SheetTitle>Add payment plan</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-name">Plan name</Label>
            <Input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. iPhone 15" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-category">Category</Label>
            <select
              id="plan-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="min-h-11 rounded-lg border border-neutral-200 px-2 text-sm text-neutral-900"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-total-amount">Total amount</Label>
            <CurrencyInput id="plan-total-amount" value={totalAmount} onChange={setTotalAmount} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-installment-count">Number of installments</Label>
            <Input
              id="plan-installment-count"
              type="number"
              min="1"
              value={installmentCount}
              onChange={(e) => setInstallmentCount(e.target.value)}
              placeholder="e.g. 12"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-monthly-amount">Monthly amount</Label>
            <CurrencyInput id="plan-monthly-amount" value={monthlyAmount} onChange={setMonthlyAmount} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-start-date">Start date</Label>
            <Input id="plan-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
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
