export interface ExtractedReceiptFields {
  merchant: string | null;
  date: string | null; // ISO 'yyyy-MM-dd' when parseable
  amount: number | null;
  rawText: string;
}

export type OcrStatus = 'idle' | 'processing' | 'done' | 'error';
