import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityLogEntryTile } from './ActivityLogEntryTile';
import type { AuditLogEntry } from '@/lib/audit-log-repository';

const baseEntry: AuditLogEntry = {
  id: 'log-1',
  actorId: 'user-1',
  actorEmail: 'sil@hhccs.com.au',
  action: 'create',
  entityType: 'bill',
  entityId: 'bill-1',
  entityLabel: 'Internet Bill',
  beforeValue: null,
  afterValue: { amount: 59.99 },
  createdAt: '2026-08-12T10:00:00.000Z',
};

describe('ActivityLogEntryTile', () => {
  it('shows the action label, entity label, and actor email', () => {
    render(<ActivityLogEntryTile entry={baseEntry} />);
    const tile = screen.getByTestId('activity-log-entry');
    expect(tile).toHaveTextContent('Created');
    expect(tile).toHaveTextContent('Internet Bill');
    expect(tile).toHaveTextContent('sil@hhccs.com.au');
  });

  it('tints the tile to match the action', () => {
    render(<ActivityLogEntryTile entry={baseEntry} />);
    expect(screen.getByTestId('activity-log-entry')).toHaveClass('bg-status-success/10');
  });

  it('shows an after value in an expandable details section when present', () => {
    render(<ActivityLogEntryTile entry={baseEntry} />);
    expect(screen.getByTestId('activity-log-after')).toHaveTextContent('amount: 59.99');
    expect(screen.queryByTestId('activity-log-before')).not.toBeInTheDocument();
  });

  it('shows both before and after values for an update', () => {
    const update: AuditLogEntry = { ...baseEntry, action: 'update', beforeValue: { amount: 50 }, afterValue: { amount: 59.99 } };
    render(<ActivityLogEntryTile entry={update} />);
    expect(screen.getByTestId('activity-log-before')).toHaveTextContent('amount: 50');
    expect(screen.getByTestId('activity-log-after')).toHaveTextContent('amount: 59.99');
  });

  it('shows no details section when neither value is present', () => {
    const deleted: AuditLogEntry = { ...baseEntry, action: 'delete', afterValue: null };
    render(<ActivityLogEntryTile entry={deleted} />);
    expect(screen.queryByTestId('activity-log-before')).not.toBeInTheDocument();
    expect(screen.queryByTestId('activity-log-after')).not.toBeInTheDocument();
  });
});
