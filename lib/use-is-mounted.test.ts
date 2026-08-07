import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIsMounted } from './use-is-mounted';

describe('useIsMounted', () => {
  it('returns true once mounted on the client', () => {
    const { result } = renderHook(() => useIsMounted());
    expect(result.current).toBe(true);
  });
});
