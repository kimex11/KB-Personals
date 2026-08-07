import { describe, expect, it } from 'vitest';
import { parseReceiptText } from './receipt-ocr-parser';

describe('parseReceiptText', () => {
  it('extracts the merchant from the first non-empty line', () => {
    const text = '\n\nWhole Foods Market\n123 Main St\nTOTAL $42.18\n08/15/2026\n';
    expect(parseReceiptText(text).merchant).toBe('Whole Foods Market');
  });

  it('extracts a slash-formatted date and normalizes it to ISO', () => {
    const text = 'Corner Cafe\nDate: 08/15/2026\nTotal $12.50';
    expect(parseReceiptText(text).date).toBe('2026-08-15');
  });

  it('extracts an ISO-formatted date as-is', () => {
    const text = 'Corner Cafe\n2026-08-15\nTotal $12.50';
    expect(parseReceiptText(text).date).toBe('2026-08-15');
  });

  it('returns null date when no recognizable date is present', () => {
    const text = 'Corner Cafe\nThanks for visiting\nTotal $12.50';
    expect(parseReceiptText(text).date).toBeNull();
  });

  it('extracts the amount from a line containing "total"', () => {
    const text = 'Corner Cafe\nSubtotal $10.00\nTax $2.50\nTotal $12.50';
    expect(parseReceiptText(text).amount).toBe(12.5);
  });

  it('falls back to the largest currency-like number when no "total" line exists', () => {
    const text = 'Corner Cafe\nCoffee $4.50\nMuffin $3.25';
    expect(parseReceiptText(text).amount).toBe(4.5);
  });

  it('returns null amount when no currency-like number is present', () => {
    const text = 'Corner Cafe\nThanks for visiting';
    expect(parseReceiptText(text).amount).toBeNull();
  });

  it('returns null merchant for empty text', () => {
    const result = parseReceiptText('');
    expect(result.merchant).toBeNull();
    expect(result.date).toBeNull();
    expect(result.amount).toBeNull();
  });

  it('preserves the original raw text', () => {
    const text = 'Corner Cafe\nTotal $12.50';
    expect(parseReceiptText(text).rawText).toBe(text);
  });
});
