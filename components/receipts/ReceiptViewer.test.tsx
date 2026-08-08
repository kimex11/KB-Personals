import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { format, parseISO } from 'date-fns';
import { ReceiptViewer } from './ReceiptViewer';
import type { StoredReceipt } from '@/lib/receipts-types';

vi.mock('react-zoom-pan-pinch', () => ({
  TransformWrapper: ({ children }: { children: React.ReactNode }) => <div data-testid="zoom-wrapper">{children}</div>,
  TransformComponent: ({ children }: { children: React.ReactNode }) => <div data-testid="zoom-component">{children}</div>,
}));

const receipt: StoredReceipt = {
  id: '1',
  fileName: 'corner-cafe.jpg',
  fileType: 'image/jpeg',
  fileSize: 204800,
  previewUrl: 'https://signed.example/corner-cafe.jpg',
  storagePath: 'user-1/corner-cafe.jpg',
  merchant: null,
  receiptDate: null,
  amount: null,
  linkedBillId: null,
  description: null,
  uploadedAt: '2026-08-15T10:00:00.000Z',
};

describe('ReceiptViewer', () => {
  it('renders nothing when there is no receipt', () => {
    const { container } = render(<ReceiptViewer receipt={null} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the receipt image and file name', () => {
    render(<ReceiptViewer receipt={receipt} onClose={vi.fn()} />);
    expect(screen.getByTestId('receipt-viewer-image')).toHaveAttribute('src', receipt.previewUrl);
    expect(screen.getByText('corner-cafe.jpg')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<ReceiptViewer receipt={receipt} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a fallback message when the image fails to load', () => {
    render(<ReceiptViewer receipt={receipt} onClose={vi.fn()} />);
    fireEvent.error(screen.getByTestId('receipt-viewer-image'));
    expect(screen.getByTestId('receipt-viewer-error')).toBeInTheDocument();
    expect(screen.queryByTestId('receipt-viewer-image')).not.toBeInTheDocument();
  });

  it('shows the upload date and time', () => {
    render(<ReceiptViewer receipt={receipt} onClose={vi.fn()} />);
    const expected = format(parseISO(receipt.uploadedAt), 'MMM d, yyyy · h:mm a');
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('does not show a rename button when onRename is not provided', () => {
    render(<ReceiptViewer receipt={receipt} onClose={vi.fn()} />);
    expect(screen.queryByTestId('receipt-viewer-rename-button')).not.toBeInTheDocument();
  });

  it('renames the receipt when a new name is saved', () => {
    const onRename = vi.fn();
    render(<ReceiptViewer receipt={receipt} onClose={vi.fn()} onRename={onRename} />);

    fireEvent.click(screen.getByTestId('receipt-viewer-rename-button'));
    const input = screen.getByTestId('receipt-viewer-name-input');
    expect(input).toHaveValue('corner-cafe.jpg');

    fireEvent.change(input, { target: { value: 'grocery-run.jpg' } });
    fireEvent.click(screen.getByTestId('receipt-viewer-name-save'));

    expect(onRename).toHaveBeenCalledWith('1', 'grocery-run.jpg');
    expect(screen.queryByTestId('receipt-viewer-name-input')).not.toBeInTheDocument();
    expect(screen.getByText('corner-cafe.jpg')).toBeInTheDocument();
  });

  it('does not call onRename when the name is unchanged or blank', () => {
    const onRename = vi.fn();
    render(<ReceiptViewer receipt={receipt} onClose={vi.fn()} onRename={onRename} />);

    fireEvent.click(screen.getByTestId('receipt-viewer-rename-button'));
    fireEvent.click(screen.getByTestId('receipt-viewer-name-save'));
    expect(onRename).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('receipt-viewer-rename-button'));
    fireEvent.change(screen.getByTestId('receipt-viewer-name-input'), { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('receipt-viewer-name-save'));
    expect(onRename).not.toHaveBeenCalled();
  });

  it('cancels renaming without calling onRename', () => {
    const onRename = vi.fn();
    render(<ReceiptViewer receipt={receipt} onClose={vi.fn()} onRename={onRename} />);

    fireEvent.click(screen.getByTestId('receipt-viewer-rename-button'));
    fireEvent.change(screen.getByTestId('receipt-viewer-name-input'), { target: { value: 'grocery-run.jpg' } });
    fireEvent.click(screen.getByTestId('receipt-viewer-name-cancel'));

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByTestId('receipt-viewer-name-input')).not.toBeInTheDocument();
    expect(screen.getByText('corner-cafe.jpg')).toBeInTheDocument();
  });

  it('does not show the description field when onUpdateDescription is not provided', () => {
    render(<ReceiptViewer receipt={receipt} onClose={vi.fn()} />);
    expect(screen.queryByTestId('receipt-viewer-description-input')).not.toBeInTheDocument();
  });

  it('pre-fills the description field with the receipt description', () => {
    const withDescription: StoredReceipt = { ...receipt, description: 'Weekly grocery run' };
    render(<ReceiptViewer receipt={withDescription} onClose={vi.fn()} onUpdateDescription={vi.fn()} />);
    expect(screen.getByTestId('receipt-viewer-description-input')).toHaveValue('Weekly grocery run');
  });

  it('saves an edited description', () => {
    const onUpdateDescription = vi.fn();
    render(<ReceiptViewer receipt={receipt} onClose={vi.fn()} onUpdateDescription={onUpdateDescription} />);

    expect(screen.queryByTestId('receipt-viewer-description-save')).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId('receipt-viewer-description-input'), { target: { value: 'Weekly grocery run' } });
    fireEvent.click(screen.getByTestId('receipt-viewer-description-save'));

    expect(onUpdateDescription).toHaveBeenCalledWith('1', 'Weekly grocery run');
  });

  it('saves a cleared description as null', () => {
    const onUpdateDescription = vi.fn();
    const withDescription: StoredReceipt = { ...receipt, description: 'Weekly grocery run' };
    render(<ReceiptViewer receipt={withDescription} onClose={vi.fn()} onUpdateDescription={onUpdateDescription} />);

    fireEvent.change(screen.getByTestId('receipt-viewer-description-input'), { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('receipt-viewer-description-save'));

    expect(onUpdateDescription).toHaveBeenCalledWith('1', null);
  });
});
