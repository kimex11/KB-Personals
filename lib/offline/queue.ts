import { getDb } from './db';
import type { QueueEntry } from './db';

// Lazily seeded from the persisted queue's current max sequence, rather than
// starting at 0 on every module load -- if the app reloads while offline
// with entries still queued, a fresh in-memory counter starting at 0 would
// sort new mutations before older still-pending ones, breaking replay order.
let sequenceCounter: number | null = null;

async function nextSequence(): Promise<number> {
  if (sequenceCounter === null) {
    const db = await getDb();
    const all: QueueEntry[] = await db.getAll('mutation_queue');
    sequenceCounter = all.reduce((max, entry) => Math.max(max, entry.sequence), -1) + 1;
  }
  return sequenceCounter++;
}

export async function enqueueMutation(entry: Omit<QueueEntry, 'id' | 'sequence'>): Promise<void> {
  const db = await getDb();
  const sequence = await nextSequence();
  const full: QueueEntry = { ...entry, id: crypto.randomUUID(), sequence };
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

export function resetSequenceForTests(): void {
  sequenceCounter = null;
}
