import { FileText } from 'lucide-react';
import type { StoredReceipt } from '@/lib/receipts-types';
import { formatFileSize } from '@/lib/receipts-utils';

interface ReceiptCardProps {
  receipt: StoredReceipt;
  onRemove: (id: string) => void;
}

export function ReceiptCard({ receipt, onRemove }: ReceiptCardProps) {
  const isImage = receipt.fileType.startsWith('image/');

  return (
    <div
      data-testid="receipt-card"
      className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white"
    >
      <div className="flex h-28 items-center justify-center bg-neutral-50">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- previewUrl is a local blob: URL, not an optimizable remote image
          <img src={receipt.previewUrl} alt={receipt.fileName} className="h-full w-full object-cover" />
        ) : (
          <FileText className="h-8 w-8 text-neutral-300" strokeWidth={1.5} />
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-3">
        <p className="truncate text-xs font-medium text-neutral-900">{receipt.fileName}</p>
        <p className="text-[10px] text-neutral-400">{formatFileSize(receipt.fileSize)}</p>
      </div>
      <button
        type="button"
        data-testid="receipt-remove-button"
        aria-label={`Remove ${receipt.fileName}`}
        onClick={() => onRemove(receipt.id)}
        className="border-t border-neutral-100 py-1.5 text-[10px] font-medium text-status-critical"
      >
        Remove
      </button>
    </div>
  );
}
