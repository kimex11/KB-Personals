import { afterEach, describe, expect, it } from 'vitest';
import { resetDbForTests } from './db';
import { cacheList, getCachedList } from './cache';

afterEach(async () => {
  await resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kb-personals-offline');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

interface TestItem {
  id: string;
  value: string;
}

describe('cacheList / getCachedList', () => {
  it('stores and retrieves a list', async () => {
    await cacheList<TestItem>('bills', [
      { id: '1', value: 'a' },
      { id: '2', value: 'b' },
    ]);
    const result = await getCachedList<TestItem>('bills');
    expect(result).toEqual([
      { id: '1', value: 'a' },
      { id: '2', value: 'b' },
    ]);
  });

  it('replaces the previous contents on re-cache', async () => {
    await cacheList<TestItem>('bills', [{ id: '1', value: 'a' }]);
    await cacheList<TestItem>('bills', [{ id: '2', value: 'b' }]);
    const result = await getCachedList<TestItem>('bills');
    expect(result).toEqual([{ id: '2', value: 'b' }]);
  });

  it('returns an empty array when nothing has been cached', async () => {
    const result = await getCachedList<TestItem>('reminders');
    expect(result).toEqual([]);
  });
});
