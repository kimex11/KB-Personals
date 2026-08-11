import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityLogList } from './ActivityLogList';
import type { AuditLogEntry } from '@/lib/audit-log-repository';

const entries: AuditLogEntry[] = [
  { id: 'log-1', actorId: 'user-1', actorEmail: 'a@b.com', action: 'create', entityType: 'bill', entityId: 'bill-1', entityLabel: 'Rent', beforeValue: null, afterValue: { amount: 100 }, createdAt: '2026-08-12T10:00:00.000Z' },
  { id: 'log-2', actorId: 'user-1', actorEmail: 'a@b.com', action: 'delete', entityType: 'reminder', entityId: 'rem-1', entityLabel: 'Call bank', beforeValue: { title: 'Call bank' }, afterValue: null, createdAt: '2026-08-12T09:00:00.000Z' },
];

describe('ActivityLogList', () => {
  it('shows an empty state when there are no entries', () => {
    render(<ActivityLogList entries={[]} />);
    expect(screen.getByTestId('empty-state')).toHaveTextContent('No activity matches your filters.');
  });

  it('renders one tile per entry', () => {
    render(<ActivityLogList entries={entries} />);
    expect(screen.getAllByTestId('activity-log-entry')).toHaveLength(2);
  });

  it('filters entries by search query', () => {
    render(<ActivityLogList entries={entries} />);
    fireEvent.change(screen.getByTestId('activity-search-input'), { target: { value: 'rent' } });
    expect(screen.getAllByTestId('activity-log-entry')).toHaveLength(1);
  });

  it('filters entries by action chip', () => {
    render(<ActivityLogList entries={entries} />);
    fireEvent.click(screen.getByTestId('activity-filter-delete'));
    expect(screen.getAllByTestId('activity-log-entry')).toHaveLength(1);
  });

  it('filters entries by module', () => {
    render(<ActivityLogList entries={entries} />);
    fireEvent.change(screen.getByTestId('activity-entity-type-select'), { target: { value: 'reminder' } });
    expect(screen.getAllByTestId('activity-log-entry')).toHaveLength(1);
  });

  it('shows the no-matches empty state when filters exclude every entry', () => {
    render(<ActivityLogList entries={entries} />);
    fireEvent.change(screen.getByTestId('activity-search-input'), { target: { value: 'nonexistent' } });
    expect(screen.getByTestId('empty-state')).toHaveTextContent('No activity matches your filters.');
  });
});
