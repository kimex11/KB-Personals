import { describe, expect, it, vi } from 'vitest';

const mockInsert = vi.fn();
const mockOrder = vi.fn();
const mockGetUser = vi.fn();
vi.mock('./supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      insert: mockInsert,
      select: () => ({ order: mockOrder }),
    }),
  }),
}));

import { logActivity, listAuditLog } from './audit-log-repository';

describe('logActivity', () => {
  it('inserts a row with the current user as actor', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'sil@hhccs.com.au' } } });
    mockInsert.mockResolvedValue({ error: null });

    await logActivity({
      action: 'create',
      entityType: 'bill',
      entityId: 'bill-1',
      entityLabel: 'Internet Bill',
      afterValue: { amount: 59.99 },
    });

    expect(mockInsert).toHaveBeenCalledWith({
      actor_id: 'user-1',
      actor_email: 'sil@hhccs.com.au',
      action: 'create',
      entity_type: 'bill',
      entity_id: 'bill-1',
      entity_label: 'Internet Bill',
      before_value: null,
      after_value: { amount: 59.99 },
    });
  });

  it('falls back to a null actor and "unknown" email when no user is signed in', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockInsert.mockResolvedValue({ error: null });

    await logActivity({ action: 'delete', entityType: 'bill', entityId: 'bill-1', entityLabel: 'Internet Bill' });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ actor_id: null, actor_email: 'unknown' })
    );
  });

  it('throws when the insert fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'a@b.com' } } });
    mockInsert.mockResolvedValue({ error: new Error('insert failed') });

    await expect(
      logActivity({ action: 'create', entityType: 'bill', entityId: 'bill-1', entityLabel: 'X' })
    ).rejects.toThrow('insert failed');
  });
});

describe('listAuditLog', () => {
  it('maps rows to camelCase, newest first', async () => {
    mockOrder.mockResolvedValue({
      data: [
        {
          id: 'log-1',
          actor_id: 'user-1',
          actor_email: 'sil@hhccs.com.au',
          action: 'update',
          entity_type: 'bill',
          entity_id: 'bill-1',
          entity_label: 'Internet Bill',
          before_value: { amount: 50 },
          after_value: { amount: 59.99 },
          created_at: '2026-08-12T10:00:00.000Z',
        },
      ],
      error: null,
    });

    const result = await listAuditLog();

    expect(result).toEqual([
      {
        id: 'log-1',
        actorId: 'user-1',
        actorEmail: 'sil@hhccs.com.au',
        action: 'update',
        entityType: 'bill',
        entityId: 'bill-1',
        entityLabel: 'Internet Bill',
        beforeValue: { amount: 50 },
        afterValue: { amount: 59.99 },
        createdAt: '2026-08-12T10:00:00.000Z',
      },
    ]);
  });

  it('throws when the select fails', async () => {
    mockOrder.mockResolvedValue({ data: null, error: new Error('select failed') });
    await expect(listAuditLog()).rejects.toThrow('select failed');
  });
});
