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
  storagePath: 'user-1/electricity-receipt.jpg',
  merchant: null,
  receiptDate: null,
  amount: null,
  linkedBillId: null,
  description: null,
  uploadedAt: '2026-08-15T10:00:00.000Z',
};

const pdfReceipt: StoredReceipt = {
  id: '2',
  fileName: 'rent-invoice.pdf',
  fileType: 'application/pdf',
  fileSize: 1048576,
  previewUrl: 'blob:mock-url-2',
  storagePath: 'user-1/rent-invoice.pdf',
  merchant: null,
  receiptDate: null,
  amount: null,
  linkedBillId: null,
  description: null,
  uploadedAt: '2026-08-15T10:00:00.000Z',
};

const bills = [
  { id: 'bill-0', title: 'Rent' },
  { id: 'bill-1', title: 'Internet Bill' },
];

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

  it('calls onView with the receipt when the thumbnail is clicked', () => {
    const onView = vi.fn();
    render(<ReceiptCard receipt={imageReceipt} onRemove={vi.fn()} onView={onView} />);
    fireEvent.click(screen.getByTestId('receipt-thumbnail-button'));
    expect(onView).toHaveBeenCalledWith(imageReceipt);
  });

  it('renders a plain, non-clickable image when onView is not provided', () => {
    render(<ReceiptCard receipt={imageReceipt} onRemove={vi.fn()} />);
    expect(screen.queryByTestId('receipt-thumbnail-button')).not.toBeInTheDocument();
    expect(screen.getByAltText('electricity-receipt.jpg')).toBeInTheDocument();
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

  it('shows a scanning indicator while OCR is processing', () => {
    render(<ReceiptCard receipt={imageReceipt} onRemove={vi.fn()} ocrStatus="processing" />);
    expect(screen.getByTestId('receipt-ocr-status')).toHaveTextContent('Scanning');
  });

  it('shows extracted merchant, date, and amount once OCR is done', () => {
    render(
      <ReceiptCard
        receipt={imageReceipt}
        onRemove={vi.fn()}
        ocrStatus="done"
        extractedFields={{ merchant: 'Whole Foods Market', date: '2026-08-15', amount: 42.18, rawText: '...' }}
      />
    );
    const card = screen.getByTestId('receipt-card');
    expect(card).toHaveTextContent('Whole Foods Market');
    expect(card).toHaveTextContent('2026-08-15');
    expect(card).toHaveTextContent('₱42.18');
  });

  it('shows an error message when OCR fails', () => {
    render(<ReceiptCard receipt={imageReceipt} onRemove={vi.fn()} ocrStatus="error" />);
    expect(screen.getByTestId('receipt-ocr-status')).toHaveTextContent("Couldn't read this receipt");
  });

  it('shows nothing extra when OCR was never run', () => {
    render(<ReceiptCard receipt={pdfReceipt} onRemove={vi.fn()} />);
    expect(screen.queryByTestId('receipt-ocr-status')).not.toBeInTheDocument();
  });

  it('does not show a bill-link picker when no bills are provided', () => {
    render(<ReceiptCard receipt={imageReceipt} onRemove={vi.fn()} />);
    expect(screen.queryByTestId('receipt-bill-link-select')).not.toBeInTheDocument();
  });

  it('shows a bill-link picker with "Not linked" selected by default', () => {
    render(<ReceiptCard receipt={imageReceipt} onRemove={vi.fn()} bills={bills} onLinkBill={vi.fn()} />);
    expect(screen.getByTestId('receipt-bill-link-select')).toHaveValue('');
  });

  it('shows the linked bill as selected when the receipt has a linkedBillId', () => {
    const linkedReceipt: StoredReceipt = { ...imageReceipt, linkedBillId: 'bill-1' };
    render(<ReceiptCard receipt={linkedReceipt} onRemove={vi.fn()} bills={bills} onLinkBill={vi.fn()} />);
    expect(screen.getByTestId('receipt-bill-link-select')).toHaveValue('bill-1');
  });

  it('calls onLinkBill with the selected bill id when a bill is chosen', () => {
    const onLinkBill = vi.fn();
    render(<ReceiptCard receipt={imageReceipt} onRemove={vi.fn()} bills={bills} onLinkBill={onLinkBill} />);
    fireEvent.change(screen.getByTestId('receipt-bill-link-select'), { target: { value: 'bill-0' } });
    expect(onLinkBill).toHaveBeenCalledWith('1', 'bill-0');
  });

  it('calls onLinkBill with null when "Not linked" is chosen again', () => {
    const onLinkBill = vi.fn();
    const linkedReceipt: StoredReceipt = { ...imageReceipt, linkedBillId: 'bill-1' };
    render(<ReceiptCard receipt={linkedReceipt} onRemove={vi.fn()} bills={bills} onLinkBill={onLinkBill} />);
    fireEvent.change(screen.getByTestId('receipt-bill-link-select'), { target: { value: '' } });
    expect(onLinkBill).toHaveBeenCalledWith('1', null);
  });

  it('does not show a rename button when onRename is not provided', () => {
    render(<ReceiptCard receipt={imageReceipt} onRemove={vi.fn()} />);
    expect(screen.queryByTestId('receipt-rename-button')).not.toBeInTheDocument();
  });

  it('renames the receipt when a new name is saved', () => {
    const onRename = vi.fn();
    render(<ReceiptCard receipt={imageReceipt} onRemove={vi.fn()} onRename={onRename} />);

    fireEvent.click(screen.getByTestId('receipt-rename-button'));
    const input = screen.getByTestId('receipt-name-input');
    expect(input).toHaveValue('electricity-receipt.jpg');

    fireEvent.change(input, { target: { value: 'grocery-run.jpg' } });
    fireEvent.click(screen.getByTestId('receipt-name-save'));

    expect(onRename).toHaveBeenCalledWith('1', 'grocery-run.jpg');
    expect(screen.queryByTestId('receipt-name-input')).not.toBeInTheDocument();
  });

  it('does not call onRename when the name is unchanged or blank', () => {
    const onRename = vi.fn();
    render(<ReceiptCard receipt={imageReceipt} onRemove={vi.fn()} onRename={onRename} />);

    fireEvent.click(screen.getByTestId('receipt-rename-button'));
    fireEvent.click(screen.getByTestId('receipt-name-save'));
    expect(onRename).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('receipt-rename-button'));
    fireEvent.change(screen.getByTestId('receipt-name-input'), { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('receipt-name-save'));
    expect(onRename).not.toHaveBeenCalled();
  });

  it('cancels renaming without calling onRename', () => {
    const onRename = vi.fn();
    render(<ReceiptCard receipt={imageReceipt} onRemove={vi.fn()} onRename={onRename} />);

    fireEvent.click(screen.getByTestId('receipt-rename-button'));
    fireEvent.change(screen.getByTestId('receipt-name-input'), { target: { value: 'grocery-run.jpg' } });
    fireEvent.click(screen.getByTestId('receipt-name-cancel'));

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByTestId('receipt-name-input')).not.toBeInTheDocument();
    expect(screen.getByText('electricity-receipt.jpg')).toBeInTheDocument();
  });

  it('does not show the description field when onUpdateDescription is not provided', () => {
    render(<ReceiptCard receipt={imageReceipt} onRemove={vi.fn()} />);
    expect(screen.queryByTestId('receipt-description-input')).not.toBeInTheDocument();
  });

  it('pre-fills the description field with the receipt description', () => {
    const withDescription: StoredReceipt = { ...imageReceipt, description: 'Weekly grocery run' };
    render(<ReceiptCard receipt={withDescription} onRemove={vi.fn()} onUpdateDescription={vi.fn()} />);
    expect(screen.getByTestId('receipt-description-input')).toHaveValue('Weekly grocery run');
  });

  it('saves the description on blur', () => {
    const onUpdateDescription = vi.fn();
    render(<ReceiptCard receipt={imageReceipt} onRemove={vi.fn()} onUpdateDescription={onUpdateDescription} />);

    const input = screen.getByTestId('receipt-description-input');
    fireEvent.change(input, { target: { value: 'Weekly grocery run' } });
    fireEvent.blur(input);

    expect(onUpdateDescription).toHaveBeenCalledWith('1', 'Weekly grocery run');
  });

  it('saves the description on Enter and clears a blanked description to null', () => {
    const onUpdateDescription = vi.fn();
    const withDescription: StoredReceipt = { ...imageReceipt, description: 'Weekly grocery run' };
    render(<ReceiptCard receipt={withDescription} onRemove={vi.fn()} onUpdateDescription={onUpdateDescription} />);

    const input = screen.getByTestId('receipt-description-input');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onUpdateDescription).toHaveBeenCalledWith('1', null);
  });

  it('does not call onUpdateDescription when the description is unchanged', () => {
    const onUpdateDescription = vi.fn();
    render(<ReceiptCard receipt={imageReceipt} onRemove={vi.fn()} onUpdateDescription={onUpdateDescription} />);
    fireEvent.blur(screen.getByTestId('receipt-description-input'));
    expect(onUpdateDescription).not.toHaveBeenCalled();
  });
});
