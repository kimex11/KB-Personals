import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReceiptUploadZone } from './ReceiptUploadZone';

function makeFile(name: string, type: string) {
  return new File(['content'], name, { type });
}

describe('ReceiptUploadZone', () => {
  it('calls onFilesSelected with the chosen files when the file input changes', () => {
    const onFilesSelected = vi.fn();
    render(<ReceiptUploadZone onFilesSelected={onFilesSelected} />);
    const file = makeFile('receipt.jpg', 'image/jpeg');
    fireEvent.change(screen.getByTestId('receipt-file-input'), { target: { files: [file] } });
    expect(onFilesSelected).toHaveBeenCalledWith([file]);
  });

  it('calls onFilesSelected with dropped files', () => {
    const onFilesSelected = vi.fn();
    render(<ReceiptUploadZone onFilesSelected={onFilesSelected} />);
    const file = makeFile('bill.pdf', 'application/pdf');
    fireEvent.drop(screen.getByTestId('receipt-upload-zone'), {
      dataTransfer: { files: [file] },
    });
    expect(onFilesSelected).toHaveBeenCalledWith([file]);
  });
});
