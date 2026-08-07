import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(__dirname, 'app/globals.css'), 'utf-8');

describe('budget design tokens in app/globals.css', () => {
  it('defines the six validated categorical budget colors', () => {
    expect(css).toMatch(/--color-budget-1:\s*#2a78d6;/);
    expect(css).toMatch(/--color-budget-2:\s*#eb6834;/);
    expect(css).toMatch(/--color-budget-3:\s*#1baf7a;/);
    expect(css).toMatch(/--color-budget-4:\s*#eda100;/);
    expect(css).toMatch(/--color-budget-5:\s*#e87ba4;/);
    expect(css).toMatch(/--color-budget-6:\s*#008300;/);
  });

  it('defines the status-critical color for overspent categories', () => {
    expect(css).toMatch(/--color-status-critical:\s*#d03b3b;/);
  });
});
