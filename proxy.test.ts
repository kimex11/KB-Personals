import { describe, expect, it } from 'vitest';
import { PROTECTED_PATHS } from './proxy';
import { TAB_ITEMS } from './components/shell/tab-config';

describe('PROTECTED_PATHS', () => {
  it('includes every tab route, so a new tab can never ship unauthenticated by omission', () => {
    for (const tab of TAB_ITEMS) {
      expect(PROTECTED_PATHS).toContain(tab.href);
    }
  });
});
