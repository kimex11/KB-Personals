import { describe, expect, it } from 'vitest';
import { computeBillState, computeReminderState } from './priority';

const TODAY = '2026-08-07';

describe('computeBillState', () => {
  it('returns null for a paid bill regardless of due date', () => {
    expect(computeBillState({ id: 'b1', due_date: '2026-08-01', paid: true }, TODAY)).toBeNull();
  });

  it('marks a past-due unpaid bill as critical with a stable state key', () => {
    expect(computeBillState({ id: 'b1', due_date: '2026-08-01', paid: false }, TODAY)).toEqual({
      entityType: 'bill',
      entityId: 'b1',
      priority: 'critical',
      stateKey: 'overdue',
    });
  });

  it('marks a bill due today as urgent', () => {
    expect(computeBillState({ id: 'b1', due_date: TODAY, paid: false }, TODAY)).toEqual({
      entityType: 'bill',
      entityId: 'b1',
      priority: 'urgent',
      stateKey: 'due_soon:2026-08-07',
    });
  });

  it('marks a bill due within the 3-day window as urgent', () => {
    expect(computeBillState({ id: 'b1', due_date: '2026-08-10', paid: false }, TODAY)).toEqual({
      entityType: 'bill',
      entityId: 'b1',
      priority: 'urgent',
      stateKey: 'due_soon:2026-08-10',
    });
  });

  it('returns null for a bill due more than 3 days out', () => {
    expect(computeBillState({ id: 'b1', due_date: '2026-08-11', paid: false }, TODAY)).toBeNull();
  });
});

describe('computeReminderState', () => {
  it('returns null for a completed reminder', () => {
    expect(computeReminderState({ id: 'r1', due_date: '2026-08-01', completed: true }, TODAY)).toBeNull();
  });

  it('marks a due-or-overdue incomplete reminder as reminder priority', () => {
    expect(computeReminderState({ id: 'r1', due_date: TODAY, completed: false }, TODAY)).toEqual({
      entityType: 'reminder',
      entityId: 'r1',
      priority: 'reminder',
      stateKey: 'due:2026-08-07',
    });
  });

  it('returns null for a reminder due in the future', () => {
    expect(computeReminderState({ id: 'r1', due_date: '2026-08-08', completed: false }, TODAY)).toBeNull();
  });
});
