'use client';

import { useState } from 'react';
import { FileText, Pencil, Check, X } from 'lucide-react';
import type { StoredReceipt } from '@/lib/receipts-types';
import { formatFileSize } from '@/lib/receipts-utils';
import { formatCurrency } from '@/lib/format-currency';
import type { ExtractedReceiptFields, OcrStatus } from '@/lib/receipt-ocr-types';

export interface LinkableBill {
  id: string;
  title: string;
}

interface ReceiptCardProps {
  receipt: StoredReceipt;
  onRemove: (id: string) => void;
  onView?: (receipt: StoredReceipt) => void;
  onRename?: (id: string, fileName: string) => void;
  onUpdateDescription?: (id: string, description: string | null) => void;
  ocrStatus?: OcrStatus;
  extractedFields?: ExtractedReceiptFields;
  bills?: LinkableBill[];
  onLinkBill?: (receiptId: string, billId: string | null) => void;
}

export function ReceiptCard({
  receipt,
  onRemove,
  onView,
  onRename,
  onUpdateDescription,
  ocrStatus,
  extractedFields,
  bills,
  onLinkBill,
}: ReceiptCardProps) {
  const isImage = receipt.fileType.startsWith('image/');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(receipt.fileName);
  const [descriptionDraft, setDescriptionDraft] = useState(receipt.description ?? '');

  function startRename() {
    setNameDraft(receipt.fileName);
    setIsEditingName(true);
  }

  function saveRename() {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== receipt.fileName) {
      onRename?.(receipt.id, trimmed);
    }
    setIsEditingName(false);
  }

  function saveDescription() {
    const trimmed = descriptionDraft.trim();
    if (trimmed !== (receipt.description ?? '')) {
      onUpdateDescription?.(receipt.id, trimmed === '' ? null : trimmed);
    }
  }

  return (
    <div
      data-testid="receipt-card"
      className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white"
    >
      <div className="flex h-28 items-center justify-center bg-neutral-50">
        {isImage && onView ? (
          <button
            type="button"
            data-testid="receipt-thumbnail-button"
            aria-label={`View ${receipt.fileName} full size`}
            onClick={() => onView(receipt)}
            className="h-full w-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- previewUrl is a local blob: URL, not an optimizable remote image */}
            <img src={receipt.previewUrl} alt={receipt.fileName} className="h-full w-full object-cover" />
          </button>
        ) : isImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- previewUrl is a local blob: URL, not an optimizable remote image
          <img src={receipt.previewUrl} alt={receipt.fileName} className="h-full w-full object-cover" />
        ) : (
          <FileText className="h-8 w-8 text-neutral-300" strokeWidth={1.5} />
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-3">
        {isEditingName ? (
          <div className="flex items-center gap-1">
            <input
              data-testid="receipt-name-input"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="min-w-0 flex-1 rounded border border-neutral-200 px-1.5 py-0.5 text-xs text-neutral-900 outline-none"
              autoFocus
            />
            <button
              type="button"
              data-testid="receipt-name-save"
              aria-label="Save name"
              onClick={saveRename}
              className="text-status-success"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              data-testid="receipt-name-cancel"
              aria-label="Cancel rename"
              onClick={() => setIsEditingName(false)}
              className="text-neutral-400"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <p className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-900">{receipt.fileName}</p>
            {onRename && (
              <button
                type="button"
                data-testid="receipt-rename-button"
                aria-label={`Rename ${receipt.fileName}`}
                onClick={startRename}
                className="text-neutral-400"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
        <p className="text-[10px] text-neutral-400">{formatFileSize(receipt.fileSize)}</p>
        {onUpdateDescription && (
          <input
            data-testid="receipt-description-input"
            aria-label={`Description for ${receipt.fileName}`}
            value={descriptionDraft}
            onChange={(e) => setDescriptionDraft(e.target.value)}
            onBlur={saveDescription}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                saveDescription();
                e.currentTarget.blur();
              }
            }}
            placeholder="Add description"
            className="mt-0.5 rounded border border-transparent px-1 py-0.5 text-[10px] text-neutral-600 outline-none placeholder:text-neutral-400 hover:border-neutral-200 focus:border-neutral-300"
          />
        )}
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
              <p className="text-[10px] font-medium text-gold">₱{formatCurrency(extractedFields.amount)}</p>
            )}
          </div>
        )}
        {bills && bills.length > 0 && onLinkBill && (
          <select
            data-testid="receipt-bill-link-select"
            aria-label={`Link ${receipt.fileName} to a bill`}
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
