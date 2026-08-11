import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { listAuditLogMock } = vi.hoisted(() => ({ listAuditLogMock: vi.fn() }));
vi.mock('./audit-log-repository', () => ({ listAuditLog: listAuditLogMock }));

import { useAuditLog } from './use-audit-log';

describe('useAuditLog', () => {
  it('loads entries on mount', async () => {
    listAuditLogMock.mockResolvedValue([
      { id: 'log-1', actorId: 'user-1', actorEmail: 'a@b.com', action: 'create', entityType: 'bill', entityId: 'bill-1', entityLabel: 'Rent', beforeValue: null, afterValue: { amount: 100 }, createdAt: '2026-08-12T10:00:00.000Z' },
    ]);

    const { result } = renderHook(() => useAuditLog());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('sets an error message when loading fails', async () => {
    listAuditLogMock.mockRejectedValue(new Error('Could not load activity.'));

    const { result } = renderHook(() => useAuditLog());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Could not load activity.');
    expect(result.current.entries).toEqual([]);
  });
});
