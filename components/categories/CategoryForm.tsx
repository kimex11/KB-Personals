'use client';

import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CATEGORY_ICON_KEYS, ICON_MAP } from '@/lib/category-icons';
import { CATEGORY_COLOR_SLOTS, DOT_COLOR_CLASS } from '@/lib/category-colors';
import type { Category, CategoryIconKey } from '@/lib/categories-types';

interface CategoryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCategory?: Category;
  onSubmit: (input: { name: string; icon: CategoryIconKey; colorSlot: number }) => Promise<void>;
}

function iconLabel(key: CategoryIconKey): string {
  return `${key.replace(/-/g, ' ')} icon`;
}

export function CategoryForm({ open, onOpenChange, initialCategory, onSubmit }: CategoryFormProps) {
  const [name, setName] = useState(initialCategory?.name ?? '');
  const [icon, setIcon] = useState<CategoryIconKey>(initialCategory?.icon ?? CATEGORY_ICON_KEYS[0]);
  const [colorSlot, setColorSlot] = useState<number>(initialCategory?.colorSlot ?? CATEGORY_COLOR_SLOTS[0]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setName(initialCategory?.name ?? '');
    setIcon(initialCategory?.icon ?? CATEGORY_ICON_KEYS[0]);
    setColorSlot(initialCategory?.colorSlot ?? CATEGORY_COLOR_SLOTS[0]);
  }, [initialCategory, open]);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), icon, colorSlot });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>{initialCategory ? 'Edit category' : 'Add category'}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category-name">Name</Label>
            <Input id="category-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Icon</Label>
            <div className="grid grid-cols-6 gap-2">
              {CATEGORY_ICON_KEYS.map((key) => {
                const Icon = ICON_MAP[key];
                const selected = key === icon;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-label={iconLabel(key)}
                    aria-pressed={selected}
                    onClick={() => setIcon(key)}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border ${selected ? 'border-neutral-900 bg-neutral-100' : 'border-neutral-200'}`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLOR_SLOTS.map((slot) => {
                const selected = slot === colorSlot;
                return (
                  <button
                    key={slot}
                    type="button"
                    aria-label={`Color ${slot}`}
                    aria-pressed={selected}
                    onClick={() => setColorSlot(slot)}
                    className={`h-7 w-7 rounded-full ${DOT_COLOR_CLASS[slot]} ${selected ? 'ring-2 ring-neutral-900 ring-offset-2' : ''}`}
                  />
                );
              })}
            </div>
          </div>
        </div>
        <SheetFooter>
          <Button onClick={handleSubmit} disabled={name.trim() === '' || submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
