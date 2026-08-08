import { describe, expect, it } from 'vitest';
import { groupByPriority } from './grouping';

describe('groupByPriority', () => {
  it('keeps full detail for a single item', () => {
    const groups = groupByPriority([
      { priority: 'critical', title: 'Electricity Bill', amount: 84.5, dueDate: '2026-08-01', url: '/bills?open=b1' },
    ]);

    expect(groups).toEqual([
      {
        priority: 'critical',
        title: 'Electricity Bill',
        body: '₱84.50 overdue — 2026-08-01',
        tag: 'critical-/bills?open=b1',
        url: '/bills?open=b1',
      },
    ]);
  });

  it('summarizes multiple same-priority items into one group', () => {
    const groups = groupByPriority([
      { priority: 'critical', title: 'Electricity Bill', amount: 84.5, dueDate: '2026-08-01', url: '/bills?open=b1' },
      { priority: 'critical', title: 'Internet Bill', amount: 59.99, dueDate: '2026-08-02', url: '/bills?open=b2' },
    ]);

    expect(groups).toEqual([
      {
        priority: 'critical',
        title: '2 bills overdue',
        body: 'Electricity Bill, Internet Bill: ₱144.49 total',
        tag: 'critical-group',
        url: '/bills',
      },
    ]);
  });

  it('produces one group per distinct priority', () => {
    const groups = groupByPriority([
      { priority: 'critical', title: 'Electricity Bill', amount: 84.5, dueDate: '2026-08-01', url: '/bills?open=b1' },
      { priority: 'reminder', title: "Mom's birthday", dueDate: '2026-08-07', url: '/reminders?open=r1' },
    ]);

    expect(groups.map((g) => g.priority).sort()).toEqual(['critical', 'reminder']);
  });

  it('groups reminders without an amount', () => {
    const groups = groupByPriority([
      { priority: 'reminder', title: "Mom's birthday", dueDate: '2026-08-07', url: '/reminders?open=r1' },
    ]);

    expect(groups[0].body).toBe('due — 2026-08-07');
  });
});
