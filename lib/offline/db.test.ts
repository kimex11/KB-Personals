import { afterEach, describe, expect, it } from 'vitest';
import { getDb, resetDbForTests } from './db';

afterEach(async () => {
  await resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kb-personals-offline');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

describe('getDb', () => {
  it('creates bills, reminders, and mutation_queue object stores', async () => {
    const db = await getDb();
    expect(Array.from(db.objectStoreNames)).toEqual(
      expect.arrayContaining(['bills', 'reminders', 'mutation_queue'])
    );
  });

  it('returns the same database instance on repeated calls', async () => {
    const first = await getDb();
    const second = await getDb();
    expect(first).toBe(second);
  });
});
