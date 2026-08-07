import type { StoredReceipt } from '@/lib/receipts-types';
import { ReceiptCard } from './ReceiptCard';
import { EmptyState } from '@/components/shared/EmptyState';

interface ReceiptGridProps {
  receipts: StoredReceipt[];
  onRemove: (id: string) => void;
}

export function ReceiptGrid({ receipts, onRemove }: ReceiptGridProps) {
  if (receipts.length === 0) {
    return <EmptyState message="No receipts uploaded yet." />;
  }

  return (
    <div data-testid="receipt-grid" className="grid grid-cols-2 gap-3">
      {receipts.map((receipt) => (
        <ReceiptCard key={receipt.id} receipt={receipt} onRemove={onRemove} />
      ))}
    </div>
  );
}
