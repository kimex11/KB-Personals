'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { Category } from '@/lib/categories-types';

interface DeleteCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category;
  billCount: number;
  otherCategories: Category[];
  onConfirm: (reassignToId?: string) => Promise<void>;
}

export function DeleteCategoryDialog({ open, onOpenChange, category, billCount, otherCategories, onConfirm }: DeleteCategoryDialogProps) {
  const [reassignToId, setReassignToId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const needsReassignment = billCount > 0;
  const canDelete = !needsReassignment || reassignToId !== '';

  async function handleDelete() {
    setSubmitting(true);
    try {
      await onConfirm(needsReassignment ? reassignToId : undefined);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Delete {category.name}?</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          {needsReassignment ? (
            <>
              <p className="text-sm text-neutral-600">
                {billCount} {billCount === 1 ? 'bill uses' : 'bills use'} this category. Choose where to move them before deleting.
              </p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reassign-select">Reassign to</Label>
                <select
                  id="reassign-select"
                  data-testid="reassign-select"
                  value={reassignToId}
                  onChange={(e) => setReassignToId(e.target.value)}
                  className="h-8 rounded-lg border border-neutral-200 px-2 text-sm"
                >
                  <option value="">Select a category</option>
                  {otherCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <p className="text-sm text-neutral-600">This category isn&apos;t used by any bills. This can&apos;t be undone.</p>
          )}
        </div>
        <SheetFooter>
          <Button variant="destructive" onClick={handleDelete} disabled={!canDelete || submitting}>
            Delete
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
