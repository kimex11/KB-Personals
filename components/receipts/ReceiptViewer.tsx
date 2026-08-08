'use client';

import { useState } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { XIcon, Pencil } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import type { StoredReceipt } from '@/lib/receipts-types';

interface ReceiptViewerProps {
  receipt: StoredReceipt | null;
  onClose: () => void;
  onRename?: (id: string, fileName: string) => void;
  onUpdateDescription?: (id: string, description: string | null) => void;
}

export function ReceiptViewer({ receipt, onClose, onRename, onUpdateDescription }: ReceiptViewerProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(receipt?.fileName ?? '');
  const [descriptionDraft, setDescriptionDraft] = useState(receipt?.description ?? '');

  if (!receipt) return null;

  const uploadedLabel = format(parseISO(receipt.uploadedAt), 'MMM d, yyyy · h:mm a');
  const descriptionDirty = descriptionDraft.trim() !== (receipt.description ?? '');

  function startRename() {
    setNameDraft(receipt!.fileName);
    setIsEditingName(true);
  }

  function saveRename() {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== receipt!.fileName) {
      onRename?.(receipt!.id, trimmed);
    }
    setIsEditingName(false);
  }

  function saveDescription() {
    const trimmed = descriptionDraft.trim();
    onUpdateDescription?.(receipt!.id, trimmed === '' ? null : trimmed);
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="fullscreen" showCloseButton={false} className="flex flex-col gap-0 bg-black/95 p-0">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
          {isEditingName ? (
            <div className="flex flex-1 items-center gap-2">
              <input
                data-testid="receipt-viewer-name-input"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="min-w-0 flex-1 rounded-lg bg-white/10 px-2 py-1.5 text-sm text-white outline-none"
                autoFocus
              />
              <button
                type="button"
                data-testid="receipt-viewer-name-save"
                onClick={saveRename}
                className="min-h-11 rounded-lg px-3 text-sm font-medium text-gold"
              >
                Save
              </button>
              <button
                type="button"
                data-testid="receipt-viewer-name-cancel"
                onClick={() => setIsEditingName(false)}
                className="min-h-11 rounded-lg px-3 text-sm text-white/60"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-white">{receipt.fileName}</p>
              <p className="text-xs text-white/50">{uploadedLabel}</p>
            </div>
          )}
          {!isEditingName && onRename && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Rename ${receipt.fileName}`}
              data-testid="receipt-viewer-rename-button"
              onClick={startRename}
              className="min-h-11 min-w-11 text-white hover:bg-white/10 hover:text-white"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          <SheetClose
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="min-h-11 min-w-11 text-white hover:bg-white/10 hover:text-white"
              />
            }
          >
            <XIcon className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </SheetClose>
        </div>
        <div className="min-h-0 flex-1">
          {imageFailed ? (
            <div className="flex h-full items-center justify-center">
              <p data-testid="receipt-viewer-error" className="text-sm text-white">
                Couldn&apos;t load this image.
              </p>
            </div>
          ) : (
            <TransformWrapper>
              <TransformComponent
                wrapperStyle={{ width: '100%', height: '100%' }}
                contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- previewUrl is a signed Supabase URL, not an optimizable remote image */}
                <img
                  src={receipt.previewUrl}
                  alt={receipt.fileName}
                  data-testid="receipt-viewer-image"
                  className="max-h-full max-w-full object-contain"
                  onError={() => setImageFailed(true)}
                />
              </TransformComponent>
            </TransformWrapper>
          )}
        </div>
        {onUpdateDescription && (
          <div className="flex flex-col gap-2 border-t border-white/10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <label htmlFor="receipt-viewer-description" className="text-xs text-white/60">
              Description
            </label>
            <textarea
              id="receipt-viewer-description"
              data-testid="receipt-viewer-description-input"
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              rows={2}
              placeholder="Add a note about this receipt"
              className="resize-none rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none"
            />
            {descriptionDirty && (
              <button
                type="button"
                data-testid="receipt-viewer-description-save"
                onClick={saveDescription}
                className="min-h-11 self-start rounded-lg px-3 text-sm font-medium text-gold"
              >
                Save description
              </button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
