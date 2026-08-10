import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetDbForTests } from './db';
import { getQueue } from './queue';
import { attemptOrQueue } from './attempt-or-queue';

afterEach(async () => {
  await resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kb-personals-offline');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

describe('attemptOrQueue', () => {
  it('calls the live function directly and does not queue on success', async () => {
    const liveCall = vi.fn().mockResolvedValue(undefined);
    const onNetworkFailure = vi.fn();
    await attemptOrQueue('bill', 'createBill', [{ title: 'A' }], liveCall, onNetworkFailure);
    expect(liveCall).toHaveBeenCalled();
    expect(onNetworkFailure).not.toHaveBeenCalled();
    expect(await getQueue()).toEqual([]);
  });

  it('queues the mutation and calls onNetworkFailure when the live call fails with a network error', async () => {
    const liveCall = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const onNetworkFailure = vi.fn();
    await attemptOrQueue('bill', 'createBill', [{ title: 'A' }], liveCall, onNetworkFailure);
    expect(onNetworkFailure).toHaveBeenCalled();
    const queue = await getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ entity: 'bill', operation: 'createBill', args: [{ title: 'A' }] });
  });

  it('rethrows a non-network error without queuing', async () => {
    const liveCall = vi.fn().mockRejectedValue(new Error('constraint violation'));
    const onNetworkFailure = vi.fn();
    await expect(attemptOrQueue('bill', 'createBill', [{}], liveCall, onNetworkFailure)).rejects.toThrow(
      'constraint violation'
    );
    expect(onNetworkFailure).not.toHaveBeenCalled();
    expect(await getQueue()).toEqual([]);
  });
});
