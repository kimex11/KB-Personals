import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityLogList } from './ActivityLogList';
import type { AuditLogEntry } from '@/lib/audit-log-repository';

const entries: AuditLogEntry[] = [
  { id: 'log-1', actorId: 'user-1', actorEmail: 'a@b.com', action: 'create', entityType: 'bill', entityId: 'bill-1', entityLabel: 'Rent', beforeValue: null, afterValue: { amount: 100 }, createdAt: '2026-08-12T10:00:00.000Z' },
  { id: 'log-2', actorId: 'user-1', actorEmail: 'a@b.com', action: 'delete', entityType: 'reminder', entityId: 'rem-1', entityLabel: 'Call bank', beforeValue: { title: 'Call bank' }, afterValue: null, createdAt: '2026-08-12T09:00:00.000Z' },
];

describe('ActivityLogList', () => {
  it('shows an empty state when there are no entries', () => {
    render(<ActivityLogList entries={[]} />);
    expect(screen.getByTestId('empty-state')).toHaveTextContent('No activity recorded yet.');
  });

  it('renders one tile per entry', () => {
    render(<ActivityLogList entries={entries} />);
    expect(screen.getAllByTestId('activity-log-entry')).toHaveLength(2);
  });
});
