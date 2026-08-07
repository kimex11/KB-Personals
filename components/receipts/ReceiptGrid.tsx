import type { StoredReceipt } from '@/lib/receipts-types';
import type { ExtractedReceiptFields, OcrStatus } from '@/lib/receipt-ocr-types';
import { ReceiptCard, type LinkableBill } from './ReceiptCard';
import { EmptyState } from '@/components/shared/EmptyState';

interface ReceiptGridProps {
  receipts: StoredReceipt[];
  onRemove: (id: string) => void;
  ocrStatusById?: Record<string, OcrStatus>;
  ocrResultById?: Record<string, ExtractedReceiptFields>;
  bills?: LinkableBill[];
  onLinkBill?: (receiptId: string, billId: string | null) => void;
}

export function ReceiptGrid({
  receipts,
  onRemove,
  ocrStatusById,
  ocrResultById,
  bills,
  onLinkBill,
}: ReceiptGridProps) {
  if (receipts.length === 0) {
    return <EmptyState message="No receipts uploaded yet." />;
  }

  return (
    <div data-testid="receipt-grid" className="grid grid-cols-2 gap-3">
      {receipts.map((receipt) => (
        <ReceiptCard
          key={receipt.id}
          receipt={receipt}
          onRemove={onRemove}
          ocrStatus={ocrStatusById?.[receipt.id]}
          extractedFields={ocrResultById?.[receipt.id]}
          bills={bills}
          onLinkBill={onLinkBill}
        />
      ))}
    </div>
  );
}
