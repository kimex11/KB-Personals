import { getQueue, removeFromQueue } from './queue';
import type { QueueEntry } from './db';
import { createBill, updateBill, deleteBill, closeBillCycle, createRecurringBill } from '../bills-repository';
import {
  createReminder,
  updateReminder,
  deleteReminder,
  closeReminderCycle,
  createRecurringReminder,
} from '../reminders-repository';

type RepositoryFn = (...args: unknown[]) => Promise<unknown>;

const OPERATIONS: Record<QueueEntry['entity'], Record<string, RepositoryFn>> = {
  bill: {
    createBill: createBill as unknown as RepositoryFn,
    updateBill: updateBill as unknown as RepositoryFn,
    deleteBill: deleteBill as unknown as RepositoryFn,
    closeBillCycle: closeBillCycle as unknown as RepositoryFn,
    createRecurringBill: createRecurringBill as unknown as RepositoryFn,
  },
  reminder: {
    createReminder: createReminder as unknown as RepositoryFn,
    updateReminder: updateReminder as unknown as RepositoryFn,
    deleteReminder: deleteReminder as unknown as RepositoryFn,
    closeReminderCycle: closeReminderCycle as unknown as RepositoryFn,
    createRecurringReminder: createRecurringReminder as unknown as RepositoryFn,
  },
};

export interface SyncFailure {
  entry: QueueEntry;
  error: unknown;
}

export async function processQueue(refetchAndCache: () => Promise<void>): Promise<SyncFailure[]> {
  const queue = await getQueue();
  if (queue.length === 0) return [];

  const failures: SyncFailure[] = [];

  for (const entry of queue) {
    const fn = OPERATIONS[entry.entity]?.[entry.operation];
    if (!fn) {
      failures.push({ entry, error: new Error(`Unknown operation: ${entry.entity}.${entry.operation}`) });
      await removeFromQueue(entry.id);
      continue;
    }
    try {
      await fn(...entry.args);
      await removeFromQueue(entry.id);
    } catch (error) {
      failures.push({ entry, error });
      await removeFromQueue(entry.id);
    }
  }

  await refetchAndCache();
  return failures;
}
