'use client';

import { useState } from 'react';
import { extractTextFromImage } from './receipt-ocr';
import { parseReceiptText } from './receipt-ocr-parser';
import type { ExtractedReceiptFields, OcrStatus } from './receipt-ocr-types';

export function useReceiptOcr() {
  const [statusById, setStatusById] = useState<Record<string, OcrStatus>>({});
  const [resultById, setResultById] = useState<Record<string, ExtractedReceiptFields>>({});

  async function processReceipt(id: string, file: File) {
    if (!file.type.startsWith('image/')) return;

    setStatusById((prev) => ({ ...prev, [id]: 'processing' }));
    try {
      const rawText = await extractTextFromImage(file);
      setResultById((prev) => ({ ...prev, [id]: parseReceiptText(rawText) }));
      setStatusById((prev) => ({ ...prev, [id]: 'done' }));
    } catch {
      setStatusById((prev) => ({ ...prev, [id]: 'error' }));
    }
  }

  return { statusById, resultById, processReceipt };
}
