import { parse, isValid, format } from 'date-fns';
import type { ExtractedReceiptFields } from './receipt-ocr-types';

const DATE_FORMATS = ['yyyy-MM-dd', 'MM/dd/yyyy', 'M/d/yyyy', 'dd/MM/yyyy', 'MM-dd-yyyy'];
const DATE_TOKEN_REGEX = /\b(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/;
const TOTAL_LINE_REGEX = /(?<!sub)\btotal\b[^0-9]{0,10}\$?\s?([\d,]+\.\d{2})/i;
const CURRENCY_REGEX = /\$?\s?(\d{1,3}(?:,\d{3})*\.\d{2})/g;

function extractMerchant(lines: string[]): string | null {
  const firstLine = lines.find((line) => line.trim().length > 0);
  return firstLine ? firstLine.trim() : null;
}

function extractDate(text: string): string | null {
  const match = text.match(DATE_TOKEN_REGEX);
  if (!match) return null;

  const token = match[1];
  for (const dateFormat of DATE_FORMATS) {
    const parsed = parse(token, dateFormat, new Date());
    if (isValid(parsed)) {
      return format(parsed, 'yyyy-MM-dd');
    }
  }
  return null;
}

function extractAmount(text: string): number | null {
  const totalMatch = text.match(TOTAL_LINE_REGEX);
  if (totalMatch) {
    return parseFloat(totalMatch[1].replace(/,/g, ''));
  }

  const allAmounts = Array.from(text.matchAll(CURRENCY_REGEX)).map((m) => parseFloat(m[1].replace(/,/g, '')));
  if (allAmounts.length === 0) return null;
  return Math.max(...allAmounts);
}

export function parseReceiptText(rawText: string): ExtractedReceiptFields {
  const lines = rawText.split('\n');

  return {
    merchant: extractMerchant(lines),
    date: extractDate(rawText),
    amount: extractAmount(rawText),
    rawText,
  };
}
