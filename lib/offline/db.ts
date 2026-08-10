import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'kb-personals-offline';
const DB_VERSION = 1;

export interface QueueEntry {
  id: string;
  entity: 'bill' | 'reminder';
  operation: string;
  args: unknown[];
  sequence: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('bills')) db.createObjectStore('bills', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('reminders')) db.createObjectStore('reminders', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('mutation_queue')) db.createObjectStore('mutation_queue', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

export async function resetDbForTests(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
  }
  dbPromise = null;
}
