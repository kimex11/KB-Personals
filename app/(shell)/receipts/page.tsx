'use client';

import { useEffect, useRef, useState } from 'react';
import { ReceiptUploadZone } from '@/components/receipts/ReceiptUploadZone';
import { ReceiptGrid } from '@/components/receipts/ReceiptGrid';
import type { StoredReceipt } from '@/lib/receipts-types';

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<StoredReceipt[]>([]);
  const receiptsRef = useRef(receipts);

  useEffect(() => {
    receiptsRef.current = receipts;
  }, [receipts]);

  useEffect(() => {
    return () => {
      for (const receipt of receiptsRef.current) {
        URL.revokeObjectURL(receipt.previewUrl);
      }
    };
  }, []);

  function handleFilesSelected(files: File[]) {
    const newReceipts: StoredReceipt[] = files.map((file, index) => ({
      id: `receipt-${Date.now()}-${index}`,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      previewUrl: URL.createObjectURL(file),
      uploadedAt: new Date().toISOString(),
    }));
    setReceipts((prev) => [...newReceipts, ...prev]);
  }

  function handleRemove(id: string) {
    setReceipts((prev) => {
      const target = prev.find((receipt) => receipt.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((receipt) => receipt.id !== id);
    });
  }

  return (
    <div data-testid="receipts-page" className="flex flex-col gap-4 px-4 pb-24 pt-4">
      <ReceiptUploadZone onFilesSelected={handleFilesSelected} />
      <ReceiptGrid receipts={receipts} onRemove={handleRemove} />
    </div>
  );
}
