'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { Category } from '@/lib/categories-types';

interface MergeCategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onConfirm: (sourceId: string, targetId: string) => Promise<void>;
}

export function MergeCategoriesDialog({ open, onOpenChange, categories, onConfirm }: MergeCategoriesDialogProps) {
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const canMerge = sourceId !== '' && targetId !== '' && sourceId !== targetId;

  async function handleMerge() {
    setSubmitting(true);
    try {
      await onConfirm(sourceId, targetId);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Merge categories</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <p className="text-sm text-neutral-600">All bills using the first category move to the second, then the first is deleted.</p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="merge-source">Merge this category</Label>
            <select
              id="merge-source"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="h-8 rounded-lg border border-neutral-200 px-2 text-sm"
            >
              <option value="">Select a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="merge-target">Into this category</Label>
            <select
              id="merge-target"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="h-8 rounded-lg border border-neutral-200 px-2 text-sm"
            >
              <option value="">Select a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <SheetFooter>
          <Button onClick={handleMerge} disabled={!canMerge || submitting}>
            Merge
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
