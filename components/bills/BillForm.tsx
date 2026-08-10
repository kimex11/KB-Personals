'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { RecurrenceInterval } from '@/lib/bills-types';
import type { Category } from '@/lib/categories-types';
import type { Frequency, CustomIntervalUnit, AmountMode, CreateSeriesInput } from '@/lib/recurring-types';

export interface BillFormInput {
  title: string;
  categoryId: string;
  amount: number;
  dueDate: string;
  recurrence: RecurrenceInterval;
  series?: Omit<CreateSeriesInput, 'entityType'>;
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

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semi_annual', label: 'Semi-Annual' },
  { value: 'annual', label: 'Annual' },
  { value: 'custom', label: 'Custom' },
];

export function BillForm({ open, onOpenChange, categories, initialBill, onSubmit }: BillFormProps) {
  const [title, setTitle] = useState(initialBill?.title ?? '');
  const [categoryId, setCategoryId] = useState(initialBill?.categoryId ?? categories[0]?.id ?? '');
  const [amount, setAmount] = useState(initialBill?.amount?.toString() ?? '');
  const [dueDate, setDueDate] = useState(initialBill?.dueDate ?? '');
  const [recurrence, setRecurrence] = useState<RecurrenceInterval>(initialBill?.recurrence ?? null);
  const [submitting, setSubmitting] = useState(false);

  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [customIntervalUnit, setCustomIntervalUnit] = useState<CustomIntervalUnit>('day');
  const [customIntervalCount, setCustomIntervalCount] = useState('1');
  const [amountMode, setAmountMode] = useState<AmountMode>('fixed');
  const [autoRenew, setAutoRenew] = useState(true);
  const [endDate, setEndDate] = useState('');
  const [maxOccurrences, setMaxOccurrences] = useState('');

  const isCustomIntervalValid = frequency !== 'custom' || (customIntervalCount !== '' && Number(customIntervalCount) > 0);
  const isValid =
    title.trim() !== '' &&
    categoryId !== '' &&
    amount !== '' &&
    !Number.isNaN(Number(amount)) &&
    dueDate !== '' &&
    (!isRecurring || isCustomIntervalValid);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const series =
        !initialBill && isRecurring
          ? {
              frequency,
              ...(frequency === 'custom' ? { customIntervalUnit, customIntervalCount: Number(customIntervalCount) } : {}),
              amountMode,
              autoRenew,
              endDate: !autoRenew && endDate !== '' ? endDate : null,
              maxOccurrences: !autoRenew && maxOccurrences !== '' ? Number(maxOccurrences) : null,
            }
          : undefined;
      await onSubmit({ title: title.trim(), categoryId, amount: Number(amount), dueDate, recurrence, series });
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
          {!initialBill && (
            <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-3">
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  id="bill-is-recurring"
                  aria-label="Recurring"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                />
                Recurring
              </label>
              {isRecurring && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="bill-frequency">Frequency</Label>
                    <select
                      id="bill-frequency"
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value as Frequency)}
                      className="h-8 rounded-lg border border-neutral-200 px-2 text-sm"
                    >
                      {FREQUENCY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {frequency === 'custom' && (
                    <div className="flex items-end gap-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="bill-custom-count">Custom interval count</Label>
                        <Input
                          id="bill-custom-count"
                          type="number"
                          min="1"
                          value={customIntervalCount}
                          onChange={(e) => setCustomIntervalCount(e.target.value)}
                        />
                      </div>
                      <select
                        aria-label="Custom interval unit"
                        value={customIntervalUnit}
                        onChange={(e) => setCustomIntervalUnit(e.target.value as CustomIntervalUnit)}
                        className="h-8 rounded-lg border border-neutral-200 px-2 text-sm"
                      >
                        <option value="day">Days</option>
                        <option value="week">Weeks</option>
                        <option value="month">Months</option>
                      </select>
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="bill-amount-mode">Amount</Label>
                    <select
                      id="bill-amount-mode"
                      value={amountMode}
                      onChange={(e) => setAmountMode(e.target.value as AmountMode)}
                      className="h-8 rounded-lg border border-neutral-200 px-2 text-sm"
                    >
                      <option value="fixed">Fixed every cycle</option>
                      <option value="editable">Editable per cycle</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} />
                    Auto-renew (repeats indefinitely)
                  </label>
                  {!autoRenew && (
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="bill-end-date">End date</Label>
                        <Input id="bill-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="bill-max-occurrences"># of occurrences</Label>
                        <Input
                          id="bill-max-occurrences"
                          type="number"
                          min="1"
                          value={maxOccurrences}
                          onChange={(e) => setMaxOccurrences(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
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
