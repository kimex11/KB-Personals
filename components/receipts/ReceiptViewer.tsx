'use client';

import { useState } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { XIcon } from 'lucide-react';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import type { StoredReceipt } from '@/lib/receipts-types';

interface ReceiptViewerProps {
  receipt: StoredReceipt | null;
  onClose: () => void;
}

export function ReceiptViewer({ receipt, onClose }: ReceiptViewerProps) {
  const [imageFailed, setImageFailed] = useState(false);

  if (!receipt) return null;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="fullscreen" showCloseButton={false} className="items-center justify-center bg-black/95">
        <p className="absolute top-4 left-4 right-16 truncate text-sm text-white">{receipt.fileName}</p>
        <SheetClose
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-3 right-3 min-h-11 min-w-11 text-white hover:bg-white/10 hover:text-white"
            />
          }
        >
          <XIcon className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </SheetClose>
        {imageFailed ? (
          <p data-testid="receipt-viewer-error" className="text-sm text-white">
            Couldn&apos;t load this image.
          </p>
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
      </SheetContent>
    </Sheet>
  );
}
