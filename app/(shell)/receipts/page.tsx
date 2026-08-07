'use client';

import { useEffect, useRef, useState } from 'react';
import { ReceiptUploadZone } from '@/components/receipts/ReceiptUploadZone';
import { ReceiptGrid } from '@/components/receipts/ReceiptGrid';
import { useReceiptOcr } from '@/lib/use-receipt-ocr';
import { listReceipts, uploadReceipt, deleteReceipt, updateReceiptFields } from '@/lib/receipts-repository';
import type { StoredReceipt } from '@/lib/receipts-types';
import type { ExtractedReceiptFields, OcrStatus } from '@/lib/receipt-ocr-types';

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<StoredReceipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { statusById, resultById, processReceipt } = useReceiptOcr();
  const persistedOcrIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    listReceipts()
      .then(setReceipts)
      .catch(() => setError('Could not load receipts.'))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    for (const [id, fields] of Object.entries(resultById)) {
      if (!persistedOcrIds.current.has(id)) {
        persistedOcrIds.current.add(id);
        updateReceiptFields(id, fields).catch(() => {});
      }
    }
  }, [resultById]);

  async function handleFilesSelected(files: File[]) {
    setError(null);
    for (const file of files) {
      try {
        const receipt = await uploadReceipt(file);
        setReceipts((prev) => [receipt, ...prev]);
        processReceipt(receipt.id, file);
      } catch {
        setError('Could not upload receipt.');
      }
    }
  }

  const persistedResultById: Record<string, ExtractedReceiptFields> = {};
  const persistedStatusById: Record<string, OcrStatus> = {};
  for (const receipt of receipts) {
    if (receipt.merchant !== null || receipt.receiptDate !== null || receipt.amount !== null) {
      persistedResultById[receipt.id] = {
        merchant: receipt.merchant,
        date: receipt.receiptDate,
        amount: receipt.amount,
        rawText: '',
      };
      persistedStatusById[receipt.id] = 'done';
    }
  }
  const mergedResultById = { ...persistedResultById, ...resultById };
  const mergedStatusById = { ...persistedStatusById, ...statusById };

  async function handleRemove(id: string) {
    const target = receipts.find((receipt) => receipt.id === id);
    if (!target) return;

    setReceipts((prev) => prev.filter((receipt) => receipt.id !== id));
    try {
      await deleteReceipt(id, target.storagePath);
    } catch {
      setError('Could not delete receipt.');
      setReceipts((prev) => [target, ...prev]);
    }
  }

  return (
    <div data-testid="receipts-page" className="flex flex-col gap-4 px-4 pb-24 pt-4">
      <ReceiptUploadZone onFilesSelected={handleFilesSelected} />
      {error && (
        <p data-testid="receipts-error" className="text-sm text-status-critical">
          {error}
        </p>
      )}
      {isLoading ? (
        <p data-testid="receipts-loading" className="text-center text-sm text-neutral-400">
          Loading receipts…
        </p>
      ) : (
        <ReceiptGrid
          receipts={receipts}
          onRemove={handleRemove}
          ocrStatusById={mergedStatusById}
          ocrResultById={mergedResultById}
        />
      )}
    </div>
  );
}
