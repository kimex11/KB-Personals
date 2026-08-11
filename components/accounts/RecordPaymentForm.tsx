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
