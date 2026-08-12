import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(__dirname, 'app/globals.css'), 'utf-8');

describe('budget design tokens in app/globals.css', () => {
  it('defines twelve distinct, non-clashing categorical budget colors', () => {
    const hexes = Array.from({ length: 12 }, (_, i) => {
      const match = css.match(new RegExp(`--color-budget-${i + 1}:\\s*(#[0-9a-fA-F]{6});`));
      return match?.[1].toLowerCase();
    });
    expect(hexes.every(Boolean)).toBe(true);
    expect(new Set(hexes).size).toBe(12);
  });

  it('defines the status-critical color for overspent categories', () => {
    expect(css).toMatch(/--color-status-critical:\s*#d03b3b;/);
  });
});
