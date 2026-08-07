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

vi.mock('@/lib/receipts-repository', () => ({
  listReceipts: () => listReceiptsMock(),
  uploadReceipt: (file: File) => uploadReceiptMock(file),
  deleteReceipt: (id: string, path: string) => deleteReceiptMock(id, path),
}));

vi.mock('@/lib/receipt-ocr', () => ({
  extractTextFromImage: vi.fn().mockResolvedValue('Corner Cafe\nTotal $12.50\n2026-08-15'),
}));

const existingReceipt: StoredReceipt = {
  id: 'receipt-1',
  fileName: 'existing.jpg',
  fileType: 'image/jpeg',
  fileSize: 1000,
  previewUrl: 'https://signed.example/existing.jpg',
  storagePath: 'user-1/existing.jpg',
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
