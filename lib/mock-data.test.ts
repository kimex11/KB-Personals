import { describe, expect, it } from 'vitest';
import { generateMockEvents } from './mock-data';

describe('generateMockEvents', () => {
  const events = generateMockEvents(new Date(2026, 7, 1));

  it('generates events within the given month', () => {
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event.date.startsWith('2026-08')).toBe(true);
    }
  });

  it('includes every event type', () => {
    const types = new Set(events.map((event) => event.type));
    expect(types).toEqual(new Set(['bill', 'reminder', 'task']));
  });

  it('gives bills a positive amount and non-bills no amount', () => {
    for (const event of events) {
      if (event.type === 'bill') {
        expect(event.amount).toBeGreaterThan(0);
      } else {
        expect(event.amount).toBeUndefined();
      }
    }
  });

  it('assigns each event a unique id', () => {
    const ids = events.map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
