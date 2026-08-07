import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import ReceiptsPage from './page';

function makeFile(name: string, type: string) {
  return new File(['content'], name, { type });
}

vi.mock('@/lib/receipt-ocr', () => ({
  extractTextFromImage: vi.fn().mockResolvedValue('Corner Cafe\nTotal $12.50\n2026-08-15'),
}));

beforeEach(() => {
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  });
});

describe('ReceiptsPage', () => {
  it('shows an empty state before any receipts are uploaded', () => {
    render(<ReceiptsPage />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('adds a receipt card when a file is selected', () => {
    render(<ReceiptsPage />);
    const file = makeFile('receipt.jpg', 'image/jpeg');
    fireEvent.change(screen.getByTestId('receipt-file-input'), { target: { files: [file] } });
    expect(screen.getByTestId('receipt-card')).toHaveTextContent('receipt.jpg');
  });

  it('removes a receipt card when its Remove button is clicked', () => {
    render(<ReceiptsPage />);
    const file = makeFile('receipt.jpg', 'image/jpeg');
    fireEvent.change(screen.getByTestId('receipt-file-input'), { target: { files: [file] } });
    fireEvent.click(screen.getByTestId('receipt-remove-button'));
    expect(screen.queryByTestId('receipt-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('revokes any remaining object URLs when the page unmounts', () => {
    render(<ReceiptsPage />);
    const file = makeFile('receipt.jpg', 'image/jpeg');
    fireEvent.change(screen.getByTestId('receipt-file-input'), { target: { files: [file] } });
    cleanup();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('runs OCR on uploaded images and shows the extracted fields', async () => {
    render(<ReceiptsPage />);
    const file = makeFile('receipt.jpg', 'image/jpeg');
    fireEvent.change(screen.getByTestId('receipt-file-input'), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByTestId('receipt-card')).toHaveTextContent('Corner Cafe'));
    expect(screen.getByTestId('receipt-card')).toHaveTextContent('₱12.50');
  });

  it('does not run OCR on non-image files', () => {
    render(<ReceiptsPage />);
    const file = makeFile('invoice.pdf', 'application/pdf');
    fireEvent.change(screen.getByTestId('receipt-file-input'), { target: { files: [file] } });
    expect(screen.queryByTestId('receipt-ocr-status')).not.toBeInTheDocument();
  });
});
