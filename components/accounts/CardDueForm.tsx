'use client';

import { useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
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
  onUploadImage?: (file: File) => Promise<void>;
  onRemoveImage?: () => Promise<void>;
}

export function CardDueForm({ open, onOpenChange, initialCard, onSubmit, onUploadImage, onRemoveImage }: CardDueFormProps) {
  const [cardName, setCardName] = useState(initialCard?.cardName ?? '');
  const [last4, setLast4] = useState(initialCard?.last4 ?? '');
  const [statementBalance, setStatementBalance] = useState(initialCard?.statementBalance?.toString() ?? '');
  const [minimumPayment, setMinimumPayment] = useState(initialCard?.minimumPayment?.toString() ?? '');
  const [dueDate, setDueDate] = useState(initialCard?.dueDate ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);

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

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onUploadImage) return;
    setImageBusy(true);
    try {
      await onUploadImage(file);
    } finally {
      setImageBusy(false);
    }
  }

  async function handleRemoveImage() {
    if (!onRemoveImage) return;
    setImageBusy(true);
    try {
      await onRemoveImage();
    } finally {
      setImageBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>{initialCard ? 'Edit credit card' : 'Add credit card'}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          {initialCard && onUploadImage && (
            <div className="flex flex-col gap-1.5">
              <Label>Card image</Label>
              {initialCard.imageUrl ? (
                <div className="relative w-fit">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={initialCard.imageUrl} alt={`${initialCard.cardName} artwork`} className="h-24 w-36 rounded-xl object-cover" />
                  {onRemoveImage && (
                    <button
                      type="button"
                      aria-label="Remove card image"
                      onClick={handleRemoveImage}
                      disabled={imageBusy}
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ) : (
                <label className="flex h-24 w-36 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-neutral-300 text-neutral-400">
                  <ImagePlus className="h-5 w-5" />
                  <span className="text-xs">{imageBusy ? 'Uploading…' : 'Upload photo'}</span>
                  <input type="file" accept="image/*" className="sr-only" onChange={handleImageChange} disabled={imageBusy} />
                </label>
              )}
            </div>
          )}
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
