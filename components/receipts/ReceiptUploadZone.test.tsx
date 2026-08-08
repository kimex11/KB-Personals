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

  it('calls onFilesSelected with dropped image files', () => {
    const onFilesSelected = vi.fn();
    render(<ReceiptUploadZone onFilesSelected={onFilesSelected} />);
    const file = makeFile('receipt.png', 'image/png');
    fireEvent.drop(screen.getByTestId('receipt-upload-zone'), { dataTransfer: { files: [file] } });
    expect(onFilesSelected).toHaveBeenCalledWith([file]);
  });

  it('filters out non-image files dropped onto the zone', () => {
    const onFilesSelected = vi.fn();
    render(<ReceiptUploadZone onFilesSelected={onFilesSelected} />);
    const file = makeFile('invoice.pdf', 'application/pdf');
    fireEvent.drop(screen.getByTestId('receipt-upload-zone'), { dataTransfer: { files: [file] } });
    expect(onFilesSelected).not.toHaveBeenCalled();
  });

  it('opens the file picker on Enter for keyboard-only users', () => {
    render(<ReceiptUploadZone onFilesSelected={vi.fn()} />);
    const input = screen.getByTestId('receipt-file-input') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');
    fireEvent.keyDown(screen.getByTestId('receipt-upload-zone'), { key: 'Enter' });
    expect(clickSpy).toHaveBeenCalled();
  });

  it('opens the file picker on Space for keyboard-only users', () => {
    render(<ReceiptUploadZone onFilesSelected={vi.fn()} />);
    const input = screen.getByTestId('receipt-file-input') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');
    fireEvent.keyDown(screen.getByTestId('receipt-upload-zone'), { key: ' ' });
    expect(clickSpy).toHaveBeenCalled();
  });

  it('renders a Take Photo button with a camera-capture input', () => {
    render(<ReceiptUploadZone onFilesSelected={vi.fn()} />);
    const cameraInput = screen.getByTestId('receipt-camera-input') as HTMLInputElement;
    expect(cameraInput).toHaveAttribute('accept', 'image/*');
    expect(cameraInput).toHaveAttribute('capture', 'environment');
  });

  it('opens the camera input when Take Photo is clicked', () => {
    render(<ReceiptUploadZone onFilesSelected={vi.fn()} />);
    const cameraInput = screen.getByTestId('receipt-camera-input') as HTMLInputElement;
    const clickSpy = vi.spyOn(cameraInput, 'click');
    fireEvent.click(screen.getByTestId('receipt-camera-button'));
    expect(clickSpy).toHaveBeenCalled();
  });

  it('calls onFilesSelected with the photo captured via the camera input', () => {
    const onFilesSelected = vi.fn();
    render(<ReceiptUploadZone onFilesSelected={onFilesSelected} />);
    const file = makeFile('photo.jpg', 'image/jpeg');
    fireEvent.change(screen.getByTestId('receipt-camera-input'), { target: { files: [file] } });
    expect(onFilesSelected).toHaveBeenCalledWith([file]);
  });
});
