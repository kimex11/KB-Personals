'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/shared/CurrencyInput';
import type { IncomeFrequency, IncomeSource } from '@/lib/accounts-types';

export interface IncomeFormInput {
  name: string;
  amount: number;
  frequency: IncomeFrequency;
  nextDate: string;
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
  const [frequency, setFrequency] = useState<IncomeFrequency>(initialIncome?.frequency ?? 'monthly');
  const [nextDate, setNextDate] = useState(initialIncome?.nextDate ?? '');
  const [submitting, setSubmitting] = useState(false);

  const isValid = name.trim() !== '' && amount !== '' && !Number.isNaN(Number(amount)) && nextDate !== '';

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), amount: Number(amount), frequency, nextDate });
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
            <Label htmlFor="income-frequency">Frequency</Label>
            <select
              id="income-frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as IncomeFrequency)}
              className="h-8 rounded-lg border border-neutral-200 px-2 text-sm"
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="income-next-date">Next date</Label>
            <Input id="income-next-date" type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
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
