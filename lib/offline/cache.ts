import { getDb } from './db';

export async function cacheList<T extends { id: string }>(storeName: 'bills' | 'reminders', items: T[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(storeName, 'readwrite');
  await tx.store.clear();
  await Promise.all(items.map((item) => tx.store.put(item)));
  await tx.done;
}

export async function getCachedList<T>(storeName: 'bills' | 'reminders'): Promise<T[]> {
  const db = await getDb();
  return db.getAll(storeName);
}
