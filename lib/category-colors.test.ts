import { describe, expect, it } from 'vitest';
import {
  STROKE_COLOR_CLASS,
  DOT_COLOR_CLASS,
  BAR_COLOR_CLASS,
  ICON_BG_COLOR_CLASS,
  ICON_TEXT_COLOR_CLASS,
  CARD_TINT_COLOR_CLASS,
  BORDER_COLOR_CLASS,
  CATEGORY_COLOR_SLOTS,
  colorSlotForId,
} from './category-colors';

describe('category-colors', () => {
  it('defines 12 color slots', () => {
    expect(CATEGORY_COLOR_SLOTS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('has a class for every slot in each map', () => {
    CATEGORY_COLOR_SLOTS.forEach((slot) => {
      expect(STROKE_COLOR_CLASS[slot]).toMatch(/^stroke-budget-\d+$/);
      expect(DOT_COLOR_CLASS[slot]).toMatch(/^bg-budget-\d+$/);
      expect(BAR_COLOR_CLASS[slot]).toMatch(/^bg-budget-\d+$/);
      expect(ICON_BG_COLOR_CLASS[slot]).toMatch(/^bg-budget-\d+\/15$/);
      expect(ICON_TEXT_COLOR_CLASS[slot]).toMatch(/^text-budget-\d+$/);
      expect(CARD_TINT_COLOR_CLASS[slot]).toMatch(/^bg-budget-\d+\/8$/);
    });
  });

  it('preserves the existing 1-6 slot values used by Budget today', () => {
    expect(BAR_COLOR_CLASS[1]).toBe('bg-budget-1');
    expect(STROKE_COLOR_CLASS[6]).toBe('stroke-budget-6');
  });

  it('BORDER_COLOR_CLASS has a class for every slot', () => {
    CATEGORY_COLOR_SLOTS.forEach((slot) => {
      expect(BORDER_COLOR_CLASS[slot]).toMatch(/^border-budget-\d+$/);
    });
  });
});

describe('colorSlotForId', () => {
  it('returns a value within the valid slot range', () => {
    for (const id of ['card-1', 'income-1', 'a', '', 'some-long-uuid-1234-5678']) {
      const slot = colorSlotForId(id);
      expect(CATEGORY_COLOR_SLOTS).toContain(slot);
    }
  });

  it('is deterministic for the same id', () => {
    expect(colorSlotForId('card-1')).toBe(colorSlotForId('card-1'));
  });

  it('spreads different ids across multiple distinct slots', () => {
    const ids = Array.from({ length: 30 }, (_, i) => `entity-${i}`);
    const slots = new Set(ids.map(colorSlotForId));
    expect(slots.size).toBeGreaterThan(1);
  });
});
