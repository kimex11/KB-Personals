import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetDbForTests } from './db';
import { enqueueMutation, getQueue } from './queue';

const { createBillMock, deleteBillMock } = vi.hoisted(() => ({
  createBillMock: vi.fn(),
  deleteBillMock: vi.fn(),
}));
vi.mock('../bills-repository', () => ({
  createBill: createBillMock,
  updateBill: vi.fn(),
  deleteBill: deleteBillMock,
  closeBillCycle: vi.fn(),
  createRecurringBill: vi.fn(),
}));
vi.mock('../reminders-repository', () => ({
  createReminder: vi.fn(),
  updateReminder: vi.fn(),
  deleteReminder: vi.fn(),
  closeReminderCycle: vi.fn(),
  createRecurringReminder: vi.fn(),
}));

import { processQueue } from './sync-engine';

afterEach(async () => {
  vi.clearAllMocks();
  await resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kb-personals-offline');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

describe('processQueue', () => {
  it('replays entries in order and removes them on success', async () => {
    createBillMock.mockResolvedValue(undefined);
    deleteBillMock.mockResolvedValue(undefined);
    await enqueueMutation({ entity: 'bill', operation: 'createBill', args: [{ title: 'A' }] });
    await enqueueMutation({ entity: 'bill', operation: 'deleteBill', args: ['bill-1'] });

    const refetchAndCache = vi.fn().mockResolvedValue(undefined);
    const failures = await processQueue(refetchAndCache);

    expect(createBillMock).toHaveBeenCalledWith({ title: 'A' });
    expect(deleteBillMock).toHaveBeenCalledWith('bill-1');
    expect(createBillMock.mock.invocationCallOrder[0]).toBeLessThan(deleteBillMock.mock.invocationCallOrder[0]);
    expect(failures).toEqual([]);
    expect(await getQueue()).toEqual([]);
    expect(refetchAndCache).toHaveBeenCalledTimes(1);
  });

  it('drops a failing entry and reports it without blocking the rest of the queue', async () => {
    createBillMock.mockRejectedValue(new Error('conflict'));
    deleteBillMock.mockResolvedValue(undefined);
    await enqueueMutation({ entity: 'bill', operation: 'createBill', args: [{ title: 'A' }] });
    await enqueueMutation({ entity: 'bill', operation: 'deleteBill', args: ['bill-1'] });

    const refetchAndCache = vi.fn().mockResolvedValue(undefined);
    const failures = await processQueue(refetchAndCache);

    expect(deleteBillMock).toHaveBeenCalled();
    expect(failures).toHaveLength(1);
    expect(failures[0].entry.operation).toBe('createBill');
    expect(await getQueue()).toEqual([]);
  });

  it('does not call refetchAndCache when the queue is empty', async () => {
    const refetchAndCache = vi.fn().mockResolvedValue(undefined);
    const failures = await processQueue(refetchAndCache);
    expect(refetchAndCache).not.toHaveBeenCalled();
    expect(failures).toEqual([]);
  });
});
