import { afterEach, describe, expect, it } from 'vitest';
import { resetDbForTests } from './db';
import { enqueueMutation, getQueue, removeFromQueue } from './queue';

afterEach(async () => {
  await resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kb-personals-offline');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

describe('enqueueMutation / getQueue / removeFromQueue', () => {
  it('returns queued entries in insertion order', async () => {
    await enqueueMutation({ entity: 'bill', operation: 'createBill', args: [{ title: 'A' }] });
    await enqueueMutation({ entity: 'bill', operation: 'deleteBill', args: ['bill-1'] });
    const queue = await getQueue();
    expect(queue.map((e) => e.operation)).toEqual(['createBill', 'deleteBill']);
  });

  it('assigns each entry a unique id', async () => {
    await enqueueMutation({ entity: 'reminder', operation: 'createReminder', args: [{}] });
    await enqueueMutation({ entity: 'reminder', operation: 'createReminder', args: [{}] });
    const queue = await getQueue();
    expect(queue[0].id).not.toBe(queue[1].id);
  });

  it('removes an entry by id', async () => {
    await enqueueMutation({ entity: 'bill', operation: 'createBill', args: [{}] });
    const [entry] = await getQueue();
    await removeFromQueue(entry.id);
    expect(await getQueue()).toEqual([]);
  });
});
