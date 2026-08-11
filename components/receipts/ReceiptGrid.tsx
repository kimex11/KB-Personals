import type { StoredReceipt } from '@/lib/receipts-types';
import type { ExtractedReceiptFields, OcrStatus } from '@/lib/receipt-ocr-types';
import { ReceiptCard, type LinkableBill } from './ReceiptCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { TileGrid } from '@/components/shared/TileGrid';

interface ReceiptGridProps {
  receipts: StoredReceipt[];
  onRemove: (id: string) => void;
  onView?: (receipt: StoredReceipt) => void;
  onRename?: (id: string, fileName: string) => void;
  onUpdateDescription?: (id: string, description: string | null) => void;
  ocrStatusById?: Record<string, OcrStatus>;
  ocrResultById?: Record<string, ExtractedReceiptFields>;
  bills?: LinkableBill[];
  onLinkBill?: (receiptId: string, billId: string | null) => void;
}

export function ReceiptGrid({
  receipts,
  onRemove,
  onView,
  onRename,
  onUpdateDescription,
  ocrStatusById,
  ocrResultById,
  bills,
  onLinkBill,
}: ReceiptGridProps) {
  if (receipts.length === 0) {
    return <EmptyState message="No receipts uploaded yet." />;
  }

  return (
    <TileGrid testId="receipt-grid">
      {receipts.map((receipt) => (
        <ReceiptCard
          key={receipt.id}
          receipt={receipt}
          onRemove={onRemove}
          onView={onView}
          onRename={onRename}
          onUpdateDescription={onUpdateDescription}
          ocrStatus={ocrStatusById?.[receipt.id]}
          extractedFields={ocrResultById?.[receipt.id]}
          bills={bills}
          onLinkBill={onLinkBill}
        />
      ))}
    </TileGrid>
  );
}
