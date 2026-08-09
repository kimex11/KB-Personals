'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { Priority } from '@/lib/reminders-types';
import type { Frequency, CustomIntervalUnit, CreateSeriesInput } from '@/lib/recurring-types';

export interface ReminderFormInput {
  title: string;
  category: string;
  dueDate: string;
  priority: Priority;
  series?: Omit<CreateSeriesInput, 'entityType' | 'amountMode'>;
}

interface ReminderFormInitial {
  title: string;
  category: string;
  dueDate: string;
  priority: Priority;
}

interface ReminderFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialReminder?: ReminderFormInitial;
  onSubmit: (input: ReminderFormInput) => Promise<void>;
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

export function ReminderForm({ open, onOpenChange, initialReminder, onSubmit }: ReminderFormProps) {
  const [title, setTitle] = useState(initialReminder?.title ?? '');
  const [category, setCategory] = useState(initialReminder?.category ?? '');
  const [dueDate, setDueDate] = useState(initialReminder?.dueDate ?? '');
  const [priority, setPriority] = useState<Priority>(initialReminder?.priority ?? 'medium');
  const [submitting, setSubmitting] = useState(false);

  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>('weekly');
  const [customIntervalUnit, setCustomIntervalUnit] = useState<CustomIntervalUnit>('day');
  const [customIntervalCount, setCustomIntervalCount] = useState('1');
  const [autoRenew, setAutoRenew] = useState(true);
  const [endDate, setEndDate] = useState('');
  const [maxOccurrences, setMaxOccurrences] = useState('');

  const isValid = title.trim() !== '' && category.trim() !== '' && dueDate !== '';

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const series =
        !initialReminder && isRecurring
          ? {
              frequency,
              ...(frequency === 'custom' ? { customIntervalUnit, customIntervalCount: Number(customIntervalCount) } : {}),
              autoRenew,
              endDate: !autoRenew && endDate !== '' ? endDate : null,
              maxOccurrences: !autoRenew && maxOccurrences !== '' ? Number(maxOccurrences) : null,
            }
          : undefined;
      await onSubmit({ title: title.trim(), category: category.trim(), dueDate, priority, series });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>{initialReminder ? 'Edit reminder' : 'Add reminder'}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reminder-title">Title</Label>
            <Input id="reminder-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reminder-category">Category</Label>
            <Input id="reminder-category" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reminder-due-date">Due date</Label>
            <Input id="reminder-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reminder-priority">Priority</Label>
            <select
              id="reminder-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="h-8 rounded-lg border border-neutral-200 px-2 text-sm"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          {!initialReminder && (
            <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-3">
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  id="reminder-is-recurring"
                  aria-label="Recurring"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                />
                Recurring
              </label>
              {isRecurring && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="reminder-frequency">Frequency</Label>
                    <select
                      id="reminder-frequency"
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
                        <Label htmlFor="reminder-custom-count">Custom interval count</Label>
                        <Input
                          id="reminder-custom-count"
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
                  <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} />
                    Auto-renew (repeats indefinitely)
                  </label>
                  {!autoRenew && (
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="reminder-end-date">End date</Label>
                        <Input id="reminder-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="reminder-max-occurrences"># of occurrences</Label>
                        <Input
                          id="reminder-max-occurrences"
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
