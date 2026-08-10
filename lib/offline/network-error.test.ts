import { describe, expect, it } from 'vitest';
import { isNetworkError } from './network-error';

describe('isNetworkError', () => {
  it('returns true for a TypeError from a failed fetch', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('returns false for a generic Error', () => {
    expect(isNetworkError(new Error('constraint violation'))).toBe(false);
  });

  it('returns false for a non-Error value', () => {
    expect(isNetworkError('some string')).toBe(false);
  });

  it('returns false for a TypeError unrelated to fetch', () => {
    expect(isNetworkError(new TypeError('Cannot read properties of undefined'))).toBe(false);
  });
});
