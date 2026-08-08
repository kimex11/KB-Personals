import { describe, expect, it, vi } from 'vitest';

const mockSelect = vi.fn();
vi.mock('./supabase/client', () => ({
  createClient: () => ({
    from: () => ({ select: mockSelect }),
  }),
}));

import { listSentStateKeys } from './notification-log-repository';

describe('listSentStateKeys', () => {
  it('returns a set of entityType:entityId:stateKey strings', async () => {
    mockSelect.mockResolvedValue({
      data: [
        { entity_type: 'bill', entity_id: 'b1', state_key: 'overdue' },
        { entity_type: 'reminder', entity_id: 'r1', state_key: 'due:2026-08-07' },
      ],
      error: null,
    });

    const result = await listSentStateKeys();

    expect(result).toEqual(new Set(['bill:b1:overdue', 'reminder:r1:due:2026-08-07']));
  });

  it('returns an empty set on error', async () => {
    mockSelect.mockResolvedValue({ data: null, error: new Error('boom') });

    const result = await listSentStateKeys();

    expect(result).toEqual(new Set());
  });
});
