import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useReceiptOcr } from './use-receipt-ocr';

vi.mock('./receipt-ocr', () => ({
  extractTextFromImage: vi.fn(),
}));

import { extractTextFromImage } from './receipt-ocr';

function makeFile(name: string, type: string) {
  return new File(['content'], name, { type });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('useReceiptOcr', () => {
  it('sets status to "processing" then "done" and stores parsed fields on success', async () => {
    vi.mocked(extractTextFromImage).mockResolvedValue('Corner Cafe\nTotal $12.50\n2026-08-15');
    const { result } = renderHook(() => useReceiptOcr());

    act(() => {
      result.current.processReceipt('1', makeFile('r.jpg', 'image/jpeg'));
    });
    expect(result.current.statusById['1']).toBe('processing');

    await waitFor(() => expect(result.current.statusById['1']).toBe('done'));
    expect(result.current.resultById['1']).toEqual({
      merchant: 'Corner Cafe',
      date: '2026-08-15',
      amount: 12.5,
      rawText: 'Corner Cafe\nTotal $12.50\n2026-08-15',
    });
  });

  it('sets status to "error" when extraction throws', async () => {
    vi.mocked(extractTextFromImage).mockRejectedValue(new Error('OCR failed'));
    const { result } = renderHook(() => useReceiptOcr());

    act(() => {
      result.current.processReceipt('2', makeFile('r.jpg', 'image/jpeg'));
    });

    await waitFor(() => expect(result.current.statusById['2']).toBe('error'));
  });

  it('skips non-image files without calling extractTextFromImage', async () => {
    const { result } = renderHook(() => useReceiptOcr());

    act(() => {
      result.current.processReceipt('3', makeFile('r.pdf', 'application/pdf'));
    });

    expect(extractTextFromImage).not.toHaveBeenCalled();
    expect(result.current.statusById['3']).toBeUndefined();
  });
});
