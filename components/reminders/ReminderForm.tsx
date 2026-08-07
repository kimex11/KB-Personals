'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { Priority } from '@/lib/reminders-types';

export interface ReminderFormInput {
  title: string;
  category: string;
  dueDate: string;
  priority: Priority;
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

export function ReminderForm({ open, onOpenChange, initialReminder, onSubmit }: ReminderFormProps) {
  const [title, setTitle] = useState(initialReminder?.title ?? '');
  const [category, setCategory] = useState(initialReminder?.category ?? '');
  const [dueDate, setDueDate] = useState(initialReminder?.dueDate ?? '');
  const [priority, setPriority] = useState<Priority>(initialReminder?.priority ?? 'medium');
  const [submitting, setSubmitting] = useState(false);

  const isValid = title.trim() !== '' && category.trim() !== '' && dueDate !== '';

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmit({ title: title.trim(), category: category.trim(), dueDate, priority });
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
