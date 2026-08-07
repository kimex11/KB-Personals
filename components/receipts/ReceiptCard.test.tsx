import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReceiptCard } from './ReceiptCard';
import type { StoredReceipt } from '@/lib/receipts-types';

const imageReceipt: StoredReceipt = {
  id: '1',
  fileName: 'electricity-receipt.jpg',
  fileType: 'image/jpeg',
  fileSize: 204800,
  previewUrl: 'blob:mock-url',
  uploadedAt: '2026-08-15T10:00:00.000Z',
};

const pdfReceipt: StoredReceipt = {
  id: '2',
  fileName: 'rent-invoice.pdf',
  fileType: 'application/pdf',
  fileSize: 1048576,
  previewUrl: 'blob:mock-url-2',
  uploadedAt: '2026-08-15T10:00:00.000Z',
};

describe('ReceiptCard', () => {
  it('shows the file name and formatted size', () => {
    render(<ReceiptCard receipt={imageReceipt} onRemove={vi.fn()} />);
    const card = screen.getByTestId('receipt-card');
    expect(card).toHaveTextContent('electricity-receipt.jpg');
    expect(card).toHaveTextContent('200 KB');
  });

  it('renders an image preview for image file types', () => {
    render(<ReceiptCard receipt={imageReceipt} onRemove={vi.fn()} />);
    expect(screen.getByAltText('electricity-receipt.jpg')).toHaveAttribute('src', 'blob:mock-url');
  });

  it('renders a document icon (no image) for non-image file types', () => {
    render(<ReceiptCard receipt={pdfReceipt} onRemove={vi.fn()} />);
    expect(screen.queryByAltText('rent-invoice.pdf')).not.toBeInTheDocument();
  });

  it('calls onRemove with the receipt id when Remove is clicked', () => {
    const onRemove = vi.fn();
    render(<ReceiptCard receipt={imageReceipt} onRemove={onRemove} />);
    fireEvent.click(screen.getByTestId('receipt-remove-button'));
    expect(onRemove).toHaveBeenCalledWith('1');
  });
});
