import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSoundSupported, playNotificationSound } from './notification-sound';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isSoundSupported', () => {
  it('returns true when AudioContext exists', () => {
    vi.stubGlobal('AudioContext', class {});
    expect(isSoundSupported()).toBe(true);
  });

  it('returns false when AudioContext is absent', () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(isSoundSupported()).toBe(false);
  });
});

describe('playNotificationSound', () => {
  it('does nothing when the Web Audio API is unsupported', () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(() => playNotificationSound()).not.toThrow();
  });
});
