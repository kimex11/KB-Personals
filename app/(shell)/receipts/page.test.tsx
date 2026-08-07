import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReceiptsPage from './page';
import type { StoredReceipt } from '@/lib/receipts-types';

function makeFile(name: string, type: string) {
  return new File(['content'], name, { type });
}

const listReceiptsMock = vi.fn();
const uploadReceiptMock = vi.fn();
const deleteReceiptMock = vi.fn();

const updateReceiptFieldsMock = vi.fn().mockResolvedValue(undefined);
const linkReceiptToBillMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/receipts-repository', () => ({
  listReceipts: () => listReceiptsMock(),
  uploadReceipt: (file: File) => uploadReceiptMock(file),
  deleteReceipt: (id: string, path: string) => deleteReceiptMock(id, path),
  updateReceiptFields: (id: string, fields: unknown) => updateReceiptFieldsMock(id, fields),
  linkReceiptToBill: (id: string, billId: string | null) => linkReceiptToBillMock(id, billId),
}));

vi.mock('@/lib/receipt-ocr', () => ({
  extractTextFromImage: vi.fn().mockResolvedValue('Corner Cafe\nTotal $12.50\n2026-08-15'),
}));

vi.mock('@/lib/use-bills', () => ({
  useBills: () => ({
    bills: [{ id: 'bill-1', title: 'Rent', category: 'Housing', categoryId: 'cat-1', amount: 1450, dueDate: '2026-08-16', recurrence: 'monthly', paid: false }],
    loading: false,
    error: null,
    refresh: vi.fn(),
    createBill: vi.fn(),
    updateBill: vi.fn(),
    deleteBill: vi.fn(),
    togglePaid: vi.fn(),
  }),
}));

const existingReceipt: StoredReceipt = {
  id: 'receipt-1',
  fileName: 'existing.jpg',
  fileType: 'image/jpeg',
  fileSize: 1000,
  previewUrl: 'https://signed.example/existing.jpg',
  storagePath: 'user-1/existing.jpg',
  merchant: null,
  receiptDate: null,
  amount: null,
  linkedBillId: null,
  uploadedAt: '2026-08-15T10:00:00.000Z',
};

describe('ReceiptsPage', () => {
  it('shows a loading state, then the receipts loaded from Supabase', async () => {
    listReceiptsMock.mockResolvedValue([existingReceipt]);
    render(<ReceiptsPage />);
    expect(screen.getByTestId('receipts-loading')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByTestId('receipt-card')).toHaveTextContent('existing.jpg'));
    expect(screen.queryByTestId('receipts-loading')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no receipts', async () => {
    listReceiptsMock.mockResolvedValue([]);
    render(<ReceiptsPage />);
    await waitFor(() => expect(screen.getByTestId('empty-state')).toBeInTheDocument());
  });

  it('uploads a new file via the repository and adds it to the list', async () => {
    listReceiptsMock.mockResolvedValue([]);
    const newReceipt: StoredReceipt = {
      id: 'receipt-2',
      fileName: 'new.jpg',
      fileType: 'image/jpeg',
      fileSize: 2000,
      previewUrl: 'https://signed.example/new.jpg',
      storagePath: 'user-1/new.jpg',
      merchant: null,
      receiptDate: null,
      amount: null,
      linkedBillId: null,
      uploadedAt: '2026-08-15T11:00:00.000Z',
    };
    uploadReceiptMock.mockResolvedValue(newReceipt);

    render(<ReceiptsPage />);
    await waitFor(() => expect(screen.getByTestId('empty-state')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('receipt-file-input'), {
      target: { files: [makeFile('new.jpg', 'image/jpeg')] },
    });

    await waitFor(() => expect(screen.getByTestId('receipt-card')).toHaveTextContent('new.jpg'));
    expect(uploadReceiptMock).toHaveBeenCalled();
  });

  it('shows previously-persisted OCR fields for a receipt loaded from Supabase, without waiting on new OCR', async () => {
    const receiptWithFields: StoredReceipt = {
      ...existingReceipt,
      merchant: 'Whole Foods Market',
      receiptDate: '2026-08-15',
      amount: 42.18,
    };
    listReceiptsMock.mockResolvedValue([receiptWithFields]);

    render(<ReceiptsPage />);

    await waitFor(() => expect(screen.getByTestId('receipt-card')).toHaveTextContent('Whole Foods Market'));
    expect(screen.getByTestId('receipt-card')).toHaveTextContent('₱42.18');
  });

  it('persists OCR-extracted fields back to the receipt once scanning finishes', async () => {
    listReceiptsMock.mockResolvedValue([]);
    const newReceipt: StoredReceipt = {
      id: 'receipt-3',
      fileName: 'scan.jpg',
      fileType: 'image/jpeg',
      fileSize: 2000,
      previewUrl: 'https://signed.example/scan.jpg',
      storagePath: 'user-1/scan.jpg',
      merchant: null,
      receiptDate: null,
      amount: null,
      linkedBillId: null,
      uploadedAt: '2026-08-15T11:00:00.000Z',
    };
    uploadReceiptMock.mockResolvedValue(newReceipt);

    render(<ReceiptsPage />);
    await waitFor(() => expect(screen.getByTestId('empty-state')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('receipt-file-input'), {
      target: { files: [makeFile('scan.jpg', 'image/jpeg')] },
    });

    await waitFor(() =>
      expect(updateReceiptFieldsMock).toHaveBeenCalledWith(
        'receipt-3',
        expect.objectContaining({ merchant: 'Corner Cafe', amount: 12.5 })
      )
    );
  });

  it('shows an error message when upload fails', async () => {
    listReceiptsMock.mockResolvedValue([]);
    uploadReceiptMock.mockRejectedValue(new Error('network error'));

    render(<ReceiptsPage />);
    await waitFor(() => expect(screen.getByTestId('empty-state')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('receipt-file-input'), {
      target: { files: [makeFile('new.jpg', 'image/jpeg')] },
    });

    await waitFor(() => expect(screen.getByTestId('receipts-error')).toHaveTextContent('Could not upload receipt.'));
  });

  it('removes a receipt via the repository when Remove is clicked', async () => {
    listReceiptsMock.mockResolvedValue([existingReceipt]);
    deleteReceiptMock.mockResolvedValue(undefined);

    render(<ReceiptsPage />);
    await waitFor(() => expect(screen.getByTestId('receipt-card')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('receipt-remove-button'));

    await waitFor(() => expect(screen.getByTestId('empty-state')).toBeInTheDocument());
    expect(deleteReceiptMock).toHaveBeenCalledWith('receipt-1', 'user-1/existing.jpg');
  });

  it('links a receipt to a bill via the bill-link picker', async () => {
    listReceiptsMock.mockResolvedValue([existingReceipt]);

    render(<ReceiptsPage />);
    await waitFor(() => expect(screen.getByTestId('receipt-card')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('receipt-bill-link-select'), { target: { value: 'bill-1' } });

    await waitFor(() => expect(linkReceiptToBillMock).toHaveBeenCalledWith('receipt-1', 'bill-1'));
    expect(screen.getByTestId('receipt-bill-link-select')).toHaveValue('bill-1');
  });

  it('restores the receipt and shows an error when delete fails', async () => {
    listReceiptsMock.mockResolvedValue([existingReceipt]);
    deleteReceiptMock.mockRejectedValue(new Error('network error'));

    render(<ReceiptsPage />);
    await waitFor(() => expect(screen.getByTestId('receipt-card')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('receipt-remove-button'));

    await waitFor(() => expect(screen.getByTestId('receipts-error')).toHaveTextContent('Could not delete receipt.'));
    expect(screen.getByTestId('receipt-card')).toBeInTheDocument();
  });
});
