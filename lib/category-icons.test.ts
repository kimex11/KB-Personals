import { describe, expect, it } from 'vitest';
import { ICON_MAP, CATEGORY_ICON_KEYS } from './category-icons';
import type { CategoryIconKey } from './categories-types';

describe('category-icons', () => {
  it('has exactly 24 curated icon keys', () => {
    expect(CATEGORY_ICON_KEYS).toHaveLength(24);
  });

  it('maps every key to a component', () => {
    CATEGORY_ICON_KEYS.forEach((key) => {
      expect(ICON_MAP[key]).toBeDefined();
    });
  });

  it('has no duplicate keys', () => {
    expect(new Set(CATEGORY_ICON_KEYS).size).toBe(CATEGORY_ICON_KEYS.length);
  });

  it('includes the 6 default category icons', () => {
    const defaults: CategoryIconKey[] = ['building-2', 'shopping-cart', 'car', 'film', 'zap', 'shopping-bag'];
    defaults.forEach((key) => expect(CATEGORY_ICON_KEYS).toContain(key));
  });
});
