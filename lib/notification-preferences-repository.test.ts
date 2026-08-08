import { describe, expect, it, vi } from 'vitest';

const mockSingle = vi.fn();
const mockUpsert = vi.fn();
vi.mock('./supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    from: () => ({
      select: () => ({ maybeSingle: mockSingle }),
      upsert: mockUpsert,
    }),
  }),
}));

import { getPreferences, upsertPreferences } from './notification-preferences-repository';

describe('getPreferences', () => {
  it('maps a stored row to camelCase', async () => {
    mockSingle.mockResolvedValue({
      data: {
        quiet_hours_start: '22:00:00',
        quiet_hours_end: '07:00:00',
        sound_enabled: false,
        enabled_priorities: ['critical'],
      },
      error: null,
    });

    const result = await getPreferences();

    expect(result).toEqual({
      quietHoursStart: '22:00:00',
      quietHoursEnd: '07:00:00',
      soundEnabled: false,
      enabledPriorities: ['critical'],
    });
  });

  it('returns defaults when no row exists yet', async () => {
    mockSingle.mockResolvedValue({ data: null, error: null });

    const result = await getPreferences();

    expect(result).toEqual({
      quietHoursStart: null,
      quietHoursEnd: null,
      soundEnabled: true,
      enabledPriorities: ['critical', 'urgent', 'reminder'],
    });
  });
});

describe('upsertPreferences', () => {
  it('writes snake_case columns scoped to the current user', async () => {
    mockUpsert.mockResolvedValue({ error: null });

    await upsertPreferences({
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      soundEnabled: true,
      enabledPriorities: ['critical', 'urgent'],
    });

    expect(mockUpsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      quiet_hours_start: '22:00',
      quiet_hours_end: '07:00',
      sound_enabled: true,
      enabled_priorities: ['critical', 'urgent'],
    });
  });
});
