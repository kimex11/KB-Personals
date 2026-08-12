import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(__dirname, 'app/globals.css'), 'utf-8');

describe('design tokens in app/globals.css', () => {
  it('defines the gold accent and ink colors in the Tailwind v4 theme', () => {
    expect(css).toMatch(/--color-gold:\s*#B08D57;/);
    expect(css).toMatch(/--color-ink:\s*#0B0B0C;/);
  });

  it('aliases the serif font family token to the sans (Inter) CSS variable', () => {
    expect(css).toMatch(/--font-serif:\s*var\(--font-sans\);/);
  });
});
