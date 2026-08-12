'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/shared/CurrencyInput';
import type { IncomeSource } from '@/lib/accounts-types';

export interface IncomeFormInput {
  name: string;
  amount: number;
  date: string;
}

interface IncomeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialIncome?: IncomeSource;
  onSubmit: (input: IncomeFormInput) => Promise<void>;
}

export function IncomeForm({ open, onOpenChange, initialIncome, onSubmit }: IncomeFormProps) {
  const [name, setName] = useState(initialIncome?.name ?? '');
  const [amount, setAmount] = useState(initialIncome?.amount?.toString() ?? '');
  const [date, setDate] = useState(initialIncome?.date ?? format(new Date(), 'yyyy-MM-dd'));
  const [submitting, setSubmitting] = useState(false);

  const isValid = name.trim() !== '' && amount !== '' && !Number.isNaN(Number(amount)) && date !== '';

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), amount: Number(amount), date });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>{initialIncome ? 'Edit income source' : 'Add income source'}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="income-name">Name</Label>
            <Input id="income-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="income-amount">Amount</Label>
            <CurrencyInput id="income-amount" value={amount} onChange={setAmount} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="income-date">Date</Label>
            <Input id="income-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
