import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReceiptGrid } from './ReceiptGrid';
import type { StoredReceipt } from '@/lib/receipts-types';

describe('ReceiptGrid', () => {
  it('shows an empty state when there are no receipts', () => {
    render(<ReceiptGrid receipts={[]} onRemove={vi.fn()} />);
    expect(screen.getByTestId('empty-state')).toHaveTextContent('No receipts uploaded yet.');
  });

  it('renders one card per receipt', () => {
    const receipts: StoredReceipt[] = [
      { id: '1', fileName: 'a.jpg', fileType: 'image/jpeg', fileSize: 1000, previewUrl: 'blob:a', uploadedAt: '2026-08-15T10:00:00.000Z' },
      { id: '2', fileName: 'b.pdf', fileType: 'application/pdf', fileSize: 2000, previewUrl: 'blob:b', uploadedAt: '2026-08-15T10:00:00.000Z' },
    ];
    render(<ReceiptGrid receipts={receipts} onRemove={vi.fn()} />);
    expect(screen.getAllByTestId('receipt-card')).toHaveLength(2);
  });

  it('passes the matching OCR status through to each card by receipt id', () => {
    const receipts: StoredReceipt[] = [
      { id: '1', fileName: 'a.jpg', fileType: 'image/jpeg', fileSize: 1000, previewUrl: 'blob:a', uploadedAt: '2026-08-15T10:00:00.000Z' },
    ];
    render(<ReceiptGrid receipts={receipts} onRemove={vi.fn()} ocrStatusById={{ '1': 'processing' }} />);
    expect(screen.getByTestId('receipt-ocr-status')).toHaveTextContent('Scanning');
  });
});
