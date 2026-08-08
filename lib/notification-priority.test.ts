import { describe, expect, it } from 'vitest';
import { VIBRATION_PATTERNS, REQUIRES_INTERACTION, bypassesQuietHours } from './notification-priority';

describe('notification-priority', () => {
  it('defines a vibration pattern for every priority', () => {
    expect(VIBRATION_PATTERNS.critical).toEqual([400, 100, 400, 100, 400]);
    expect(VIBRATION_PATTERNS.urgent).toEqual([250, 100, 250]);
    expect(VIBRATION_PATTERNS.reminder).toEqual([150]);
  });

  it('only requires interaction for critical alerts', () => {
    expect(REQUIRES_INTERACTION.critical).toBe(true);
    expect(REQUIRES_INTERACTION.urgent).toBe(false);
    expect(REQUIRES_INTERACTION.reminder).toBe(false);
  });

  it('bypasses quiet hours for critical and urgent only', () => {
    expect(bypassesQuietHours('critical')).toBe(true);
    expect(bypassesQuietHours('urgent')).toBe(true);
    expect(bypassesQuietHours('reminder')).toBe(false);
  });
});
