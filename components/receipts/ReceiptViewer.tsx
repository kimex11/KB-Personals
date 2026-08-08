'use client';

import { useRef, useState } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { XIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import type { StoredReceipt } from '@/lib/receipts-types';

const SWIPE_CLOSE_THRESHOLD_PX = 120;

interface ReceiptViewerProps {
  receipt: StoredReceipt | null;
  onClose: () => void;
}

export function ReceiptViewer({ receipt, onClose }: ReceiptViewerProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [scale, setScale] = useState(1);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  if (!receipt) return null;

  const uploadedLabel = format(parseISO(receipt.uploadedAt), 'MMM d, yyyy · h:mm a');

  function handleTouchStart(e: React.TouchEvent) {
    if (scale > 1.01 || e.touches.length !== 1) return;
    dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setIsDragging(true);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!dragStartRef.current || e.touches.length !== 1) return;
    const dy = e.touches[0].clientY - dragStartRef.current.y;
    const dx = e.touches[0].clientX - dragStartRef.current.x;
    if (dy > 0 && dy > Math.abs(dx)) {
      setDragY(dy);
    }
  }

  function handleTouchEnd() {
    if (!dragStartRef.current) return;
    dragStartRef.current = null;
    setIsDragging(false);
    if (dragY > SWIPE_CLOSE_THRESHOLD_PX) {
      onClose();
      return;
    }
    setDragY(0);
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="fullscreen" showCloseButton={false} className="flex flex-col gap-0 bg-black/95 p-0">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-white">{receipt.fileName}</p>
            <p className="text-xs text-white/50">{uploadedLabel}</p>
          </div>
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
        <div
          data-testid="receipt-viewer-swipe-area"
          className="min-h-0 flex-1"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            transform: `translateY(${dragY}px)`,
            transition: isDragging ? 'none' : 'transform 150ms ease-out',
            opacity: 1 - Math.min(dragY / 400, 0.6),
          }}
        >
          {imageFailed ? (
            <div className="flex h-full items-center justify-center">
              <p data-testid="receipt-viewer-error" className="text-sm text-white">
                Couldn&apos;t load this image.
              </p>
            </div>
          ) : (
            <TransformWrapper onTransform={(_ref, state) => setScale(state.scale)}>
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
      </SheetContent>
    </Sheet>
  );
}
