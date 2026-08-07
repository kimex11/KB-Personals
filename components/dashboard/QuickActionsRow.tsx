'use client';

import { Receipt, Plus, Bell, Camera, ArrowLeftRight } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

const ACTIONS = [
  { id: 'bill', label: 'Add Bill', icon: Receipt },
  { id: 'expense', label: 'Add Expense', icon: Plus },
  { id: 'reminder', label: 'Add Reminder', icon: Bell },
  { id: 'receipt', label: 'Add Receipt', icon: Camera },
  { id: 'transaction', label: 'Add Transaction', icon: ArrowLeftRight },
] as const;

export function QuickActionsRow() {
  return (
    <div data-testid="quick-actions-row" className="grid grid-cols-5 gap-2">
      {ACTIONS.map(({ id, label, icon: Icon }) => (
        <Sheet key={id}>
          <SheetTrigger
            render={
              <Button
                data-testid={`quick-action-${id}`}
                aria-label={label}
                variant="ghost"
                className="flex h-auto w-auto flex-col items-center gap-1 rounded-2xl border border-neutral-200 bg-white px-2 py-3 text-neutral-700"
              />
            }
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px]">{label}</span>
          </SheetTrigger>
          <SheetContent side="bottom" data-testid={`quick-action-sheet-${id}`}>
            <p className="py-8 text-center text-neutral-500">Coming soon</p>
          </SheetContent>
        </Sheet>
      ))}
    </div>
  );
}
