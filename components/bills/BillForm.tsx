'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { RecurrenceInterval } from '@/lib/bills-types';
import type { Category } from '@/lib/categories-types';

export interface BillFormInput {
  title: string;
  categoryId: string;
  amount: number;
  dueDate: string;
  recurrence: RecurrenceInterval;
}

interface BillFormInitial {
  title: string;
  categoryId: string;
  amount: number;
  dueDate: string;
  recurrence: RecurrenceInterval;
}

interface BillFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  initialBill?: BillFormInitial;
  onSubmit: (input: BillFormInput) => Promise<void>;
}

export function BillForm({ open, onOpenChange, categories, initialBill, onSubmit }: BillFormProps) {
  const [title, setTitle] = useState(initialBill?.title ?? '');
  const [categoryId, setCategoryId] = useState(initialBill?.categoryId ?? categories[0]?.id ?? '');
  const [amount, setAmount] = useState(initialBill?.amount?.toString() ?? '');
  const [dueDate, setDueDate] = useState(initialBill?.dueDate ?? '');
  const [recurrence, setRecurrence] = useState<RecurrenceInterval>(initialBill?.recurrence ?? null);
  const [submitting, setSubmitting] = useState(false);

  const isValid = title.trim() !== '' && categoryId !== '' && amount !== '' && !Number.isNaN(Number(amount)) && dueDate !== '';

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmit({ title: title.trim(), categoryId, amount: Number(amount), dueDate, recurrence });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>{initialBill ? 'Edit bill' : 'Add bill'}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bill-title">Title</Label>
            <Input id="bill-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bill-category">Category</Label>
            <select
              id="bill-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-8 rounded-lg border border-neutral-200 px-2 text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bill-amount">Amount</Label>
            <Input id="bill-amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bill-due-date">Due date</Label>
            <Input id="bill-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bill-recurrence">Recurrence</Label>
            <select
              id="bill-recurrence"
              value={recurrence ?? ''}
              onChange={(e) => setRecurrence((e.target.value || null) as RecurrenceInterval)}
              className="h-8 rounded-lg border border-neutral-200 px-2 text-sm"
            >
              <option value="">None</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
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
