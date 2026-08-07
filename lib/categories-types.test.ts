import { describe, expect, it } from 'vitest';
import type { Category, CategoryIconKey } from './categories-types';

describe('categories-types', () => {
  it('accepts a well-formed Category', () => {
    const category: Category = {
      id: 'cat-1',
      name: 'Housing',
      icon: 'building-2',
      colorSlot: 1,
      sortOrder: 0,
      archived: false,
      createdAt: '2026-08-15T10:00:00.000Z',
    };
    expect(category.name).toBe('Housing');
  });

  it('rejects an icon key outside the curated set', () => {
    // @ts-expect-error - 'rocket' is not a CategoryIconKey
    const icon: CategoryIconKey = 'rocket';
    expect(icon).toBe('rocket');
  });
});
