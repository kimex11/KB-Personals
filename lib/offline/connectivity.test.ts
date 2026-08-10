import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnlineStatus } from './connectivity';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useOnlineStatus', () => {
  it('reflects navigator.onLine on mount', () => {
    vi.stubGlobal('navigator', { onLine: false });
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });

  it('updates to true on an online event', () => {
    vi.stubGlobal('navigator', { onLine: false });
    const { result } = renderHook(() => useOnlineStatus());
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });

  it('updates to false on an offline event', () => {
    vi.stubGlobal('navigator', { onLine: true });
    const { result } = renderHook(() => useOnlineStatus());
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);
  });
});
