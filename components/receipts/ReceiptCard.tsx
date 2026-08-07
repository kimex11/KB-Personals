import { FileText } from 'lucide-react';
import type { StoredReceipt } from '@/lib/receipts-types';
import { formatFileSize } from '@/lib/receipts-utils';
import type { ExtractedReceiptFields, OcrStatus } from '@/lib/receipt-ocr-types';

export interface LinkableBill {
  id: string;
  title: string;
}

interface ReceiptCardProps {
  receipt: StoredReceipt;
  onRemove: (id: string) => void;
  ocrStatus?: OcrStatus;
  extractedFields?: ExtractedReceiptFields;
  bills?: LinkableBill[];
  onLinkBill?: (receiptId: string, billId: string | null) => void;
}

export function ReceiptCard({ receipt, onRemove, ocrStatus, extractedFields, bills, onLinkBill }: ReceiptCardProps) {
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
        {ocrStatus === 'processing' && (
          <p data-testid="receipt-ocr-status" className="text-[10px] text-neutral-400">
            Scanning receipt…
          </p>
        )}
        {ocrStatus === 'error' && (
          <p data-testid="receipt-ocr-status" className="text-[10px] text-status-critical">
            Couldn&apos;t read this receipt
          </p>
        )}
        {ocrStatus === 'done' && extractedFields && (
          <div data-testid="receipt-ocr-status" className="mt-1 flex flex-col gap-0.5 border-t border-neutral-100 pt-1">
            {extractedFields.merchant && <p className="text-[10px] text-neutral-600">{extractedFields.merchant}</p>}
            {extractedFields.date && <p className="text-[10px] text-neutral-400">{extractedFields.date}</p>}
            {extractedFields.amount !== null && (
              <p className="text-[10px] font-medium text-gold">₱{extractedFields.amount.toFixed(2)}</p>
            )}
          </div>
        )}
        {bills && bills.length > 0 && onLinkBill && (
          <select
            data-testid="receipt-bill-link-select"
            value={receipt.linkedBillId ?? ''}
            onChange={(e) => onLinkBill(receipt.id, e.target.value === '' ? null : e.target.value)}
            className="mt-1 rounded-full border border-neutral-200 px-2 py-1 text-[10px] text-neutral-600"
          >
            <option value="">Not linked</option>
            {bills.map((bill) => (
              <option key={bill.id} value={bill.id}>
                {bill.title}
              </option>
            ))}
          </select>
        )}
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
