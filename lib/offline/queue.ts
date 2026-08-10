import { getDb } from './db';
import type { QueueEntry } from './db';

let sequenceCounter = 0;

export async function enqueueMutation(entry: Omit<QueueEntry, 'id' | 'sequence'>): Promise<void> {
  const db = await getDb();
  const full: QueueEntry = { ...entry, id: crypto.randomUUID(), sequence: sequenceCounter++ };
  await db.put('mutation_queue', full);
}

export async function getQueue(): Promise<QueueEntry[]> {
  const db = await getDb();
  const all: QueueEntry[] = await db.getAll('mutation_queue');
  return all.sort((a, b) => a.sequence - b.sequence);
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('mutation_queue', id);
}
