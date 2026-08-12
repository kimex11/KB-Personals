'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/shared/CurrencyInput';
import type { CreditCardDue } from '@/lib/accounts-types';

export interface CardDueFormInput {
  cardName: string;
  last4: string;
  statementBalance: number;
  minimumPayment: number;
  dueDate: string;
}

interface CardDueFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCard?: CreditCardDue;
  onSubmit: (input: CardDueFormInput) => Promise<void>;
}

export function CardDueForm({ open, onOpenChange, initialCard, onSubmit }: CardDueFormProps) {
  const [cardName, setCardName] = useState(initialCard?.cardName ?? '');
  const [last4, setLast4] = useState(initialCard?.last4 ?? '');
  const [statementBalance, setStatementBalance] = useState(initialCard?.statementBalance?.toString() ?? '');
  const [minimumPayment, setMinimumPayment] = useState(initialCard?.minimumPayment?.toString() ?? '');
  const [dueDate, setDueDate] = useState(initialCard?.dueDate ?? '');
  const [submitting, setSubmitting] = useState(false);

  const isValid =
    cardName.trim() !== '' &&
    /^\d{4}$/.test(last4) &&
    statementBalance !== '' &&
    !Number.isNaN(Number(statementBalance)) &&
    minimumPayment !== '' &&
    !Number.isNaN(Number(minimumPayment)) &&
    dueDate !== '';

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmit({
        cardName: cardName.trim(),
        last4,
        statementBalance: Number(statementBalance),
        minimumPayment: Number(minimumPayment),
        dueDate,
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
          <SheetTitle>{initialCard ? 'Edit credit card' : 'Add credit card'}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-name">Card name</Label>
            <Input id="card-name" value={cardName} onChange={(e) => setCardName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-last4">Last 4 digits</Label>
            <Input id="card-last4" inputMode="numeric" maxLength={4} value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-statement-balance">Statement balance</Label>
            <CurrencyInput id="card-statement-balance" value={statementBalance} onChange={setStatementBalance} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-minimum-payment">Minimum payment</Label>
            <CurrencyInput id="card-minimum-payment" value={minimumPayment} onChange={setMinimumPayment} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-due-date">Due date</Label>
            <Input id="card-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
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
