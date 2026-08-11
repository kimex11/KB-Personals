import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ActivityPage from './page';
import type { AuditLogEntry } from '@/lib/audit-log-repository';

const { listAuditLogMock } = vi.hoisted(() => ({ listAuditLogMock: vi.fn() }));
vi.mock('@/lib/audit-log-repository', () => ({ listAuditLog: listAuditLogMock }));

describe('ActivityPage', () => {
  it('shows a loading state, then the activity list', async () => {
    const entries: AuditLogEntry[] = [
      { id: 'log-1', actorId: 'user-1', actorEmail: 'a@b.com', action: 'create', entityType: 'bill', entityId: 'bill-1', entityLabel: 'Rent', beforeValue: null, afterValue: { amount: 100 }, createdAt: '2026-08-12T10:00:00.000Z' },
    ];
    listAuditLogMock.mockResolvedValue(entries);

    render(<ActivityPage />);

    await waitFor(() => expect(screen.getAllByTestId('activity-log-entry')).toHaveLength(1));
  });

  it('shows an error message when loading fails', async () => {
    listAuditLogMock.mockRejectedValue(new Error('Could not load activity.'));

    render(<ActivityPage />);

    expect(await screen.findByText('Could not load activity.')).toBeInTheDocument();
  });
});
