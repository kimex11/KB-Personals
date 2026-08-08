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

function touch(clientX: number, clientY: number) {
  return { touches: [{ clientX, clientY }] };
}

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

  it('closes when swiped down past the threshold', () => {
    const onClose = vi.fn();
    render(<ReceiptViewer receipt={receipt} onClose={onClose} />);
    const area = screen.getByTestId('receipt-viewer-swipe-area');

    fireEvent.touchStart(area, touch(200, 200));
    fireEvent.touchMove(area, touch(200, 340));
    fireEvent.touchEnd(area);

    expect(onClose).toHaveBeenCalled();
  });

  it('does not close when swiped down less than the threshold', () => {
    const onClose = vi.fn();
    render(<ReceiptViewer receipt={receipt} onClose={onClose} />);
    const area = screen.getByTestId('receipt-viewer-swipe-area');

    fireEvent.touchStart(area, touch(200, 200));
    fireEvent.touchMove(area, touch(200, 250));
    fireEvent.touchEnd(area);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close on an upward or mostly-horizontal swipe', () => {
    const onClose = vi.fn();
    render(<ReceiptViewer receipt={receipt} onClose={onClose} />);
    const area = screen.getByTestId('receipt-viewer-swipe-area');

    fireEvent.touchStart(area, touch(200, 400));
    fireEvent.touchMove(area, touch(200, 100));
    fireEvent.touchEnd(area);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.touchStart(area, touch(100, 200));
    fireEvent.touchMove(area, touch(400, 210));
    fireEvent.touchEnd(area);
    expect(onClose).not.toHaveBeenCalled();
  });
});
