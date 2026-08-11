import { describe, expect, it } from 'vitest';
import { filterAuditLog, type AuditLogFilters } from './audit-log-selectors';
import type { AuditLogEntry } from './audit-log-repository';

const baseFilters: AuditLogFilters = { query: '', actionFilter: 'all', entityTypeFilter: 'all', dateFrom: null, dateTo: null };

const entries: AuditLogEntry[] = [
  { id: 'log-1', actorId: 'user-1', actorEmail: 'sil@hhccs.com.au', action: 'create', entityType: 'bill', entityId: 'bill-1', entityLabel: 'Rent', beforeValue: null, afterValue: { amount: 1450 }, createdAt: '2026-08-10T10:00:00.000Z' },
  { id: 'log-2', actorId: 'user-1', actorEmail: 'sil@hhccs.com.au', action: 'delete', entityType: 'reminder', entityId: 'rem-1', entityLabel: 'Call bank', beforeValue: { title: 'Call bank' }, afterValue: null, createdAt: '2026-08-12T09:00:00.000Z' },
  { id: 'log-3', actorId: 'user-2', actorEmail: 'other@example.com', action: 'update', entityType: 'category', entityId: 'cat-1', entityLabel: 'Groceries', beforeValue: { colorSlot: 1 }, afterValue: { colorSlot: 2 }, createdAt: '2026-08-14T09:00:00.000Z' },
];

describe('filterAuditLog', () => {
  it('returns everything when every filter is at its default', () => {
    expect(filterAuditLog(entries, baseFilters)).toEqual(entries);
  });

  it('matches the query against the entity label', () => {
    const result = filterAuditLog(entries, { ...baseFilters, query: 'rent' });
    expect(result.map((e) => e.id)).toEqual(['log-1']);
  });

  it('matches the query against the actor email', () => {
    const result = filterAuditLog(entries, { ...baseFilters, query: 'other@example.com' });
    expect(result.map((e) => e.id)).toEqual(['log-3']);
  });

  it('filters by action', () => {
    const result = filterAuditLog(entries, { ...baseFilters, actionFilter: 'delete' });
    expect(result.map((e) => e.id)).toEqual(['log-2']);
  });

  it('filters by entity type', () => {
    const result = filterAuditLog(entries, { ...baseFilters, entityTypeFilter: 'category' });
    expect(result.map((e) => e.id)).toEqual(['log-3']);
  });

  it('filters by a date range', () => {
    const result = filterAuditLog(entries, { ...baseFilters, dateFrom: '2026-08-11', dateTo: '2026-08-13' });
    expect(result.map((e) => e.id)).toEqual(['log-2']);
  });

  it('combines multiple filters with AND semantics', () => {
    const result = filterAuditLog(entries, { ...baseFilters, actionFilter: 'update', entityTypeFilter: 'category', query: 'groceries' });
    expect(result.map((e) => e.id)).toEqual(['log-3']);
  });
});
