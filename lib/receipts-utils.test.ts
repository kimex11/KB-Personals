import { describe, expect, it } from 'vitest';
import { formatFileSize } from './receipts-utils';

describe('formatFileSize', () => {
  it('formats bytes under 1KB as "N B"', () => {
    expect(formatFileSize(512)).toBe('512 B');
  });

  it('formats sizes under 1MB as "N KB"', () => {
    expect(formatFileSize(1024 * 200)).toBe('200 KB');
  });

  it('formats sizes at or above 1MB as "N.N MB"', () => {
    expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.5 MB');
  });
});
