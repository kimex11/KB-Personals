import { describe, expect, it } from 'vitest';
import { philippinesTodayISO, philippinesNowMinutes } from './timezone';

describe('philippinesTodayISO', () => {
  it('rolls over to the next Philippines calendar day before UTC midnight', () => {
    // 2026-08-09 16:30 UTC = 2026-08-10 00:30 in the Philippines (UTC+8)
    const nowMs = Date.UTC(2026, 7, 9, 16, 30);
    expect(philippinesTodayISO(nowMs)).toBe('2026-08-10');
  });

  it('still reports the same UTC calendar day when well before the PH rollover', () => {
    // 2026-08-09 03:00 UTC = 2026-08-09 11:00 in the Philippines
    const nowMs = Date.UTC(2026, 7, 9, 3, 0);
    expect(philippinesTodayISO(nowMs)).toBe('2026-08-09');
  });
});

describe('philippinesNowMinutes', () => {
  it('converts a UTC instant to Philippines minutes-since-midnight', () => {
    // 2026-08-09 23:59 UTC = 2026-08-10 07:59 PH = 479 minutes since midnight
    const nowMs = Date.UTC(2026, 7, 9, 23, 59);
    expect(philippinesNowMinutes(nowMs)).toBe(7 * 60 + 59);
  });

  it('handles the exact UTC-to-PH rollover instant', () => {
    // 2026-08-09 16:00 UTC = 2026-08-10 00:00 PH
    const nowMs = Date.UTC(2026, 7, 9, 16, 0);
    expect(philippinesNowMinutes(nowMs)).toBe(0);
  });
});
