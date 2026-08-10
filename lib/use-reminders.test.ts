import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { cacheList } from './offline/cache';
import { getQueue } from './offline/queue';
import { resetDbForTests } from './offline/db';

const { listRemindersMock, createReminderMock, updateReminderMock, deleteReminderMock, createRecurringReminderMock, closeReminderCycleMock } = vi.hoisted(() => ({
  listRemindersMock: vi.fn(),
  createReminderMock: vi.fn(),
  updateReminderMock: vi.fn(),
  deleteReminderMock: vi.fn(),
  createRecurringReminderMock: vi.fn(),
  closeReminderCycleMock: vi.fn(),
}));

vi.mock('./reminders-repository', () => ({
  listReminders: listRemindersMock,
  createReminder: createReminderMock,
  updateReminder: updateReminderMock,
  deleteReminder: deleteReminderMock,
  createRecurringReminder: createRecurringReminderMock,
  closeReminderCycle: closeReminderCycleMock,
}));

import { useReminders } from './use-reminders';

const reminder = {
  id: 'reminder-1',
  title: 'Renew passport',
  category: 'Personal',
  dueDate: '2026-08-16',
  priority: 'high' as const,
  completed: false,
  seriesId: null,
  cycleNumber: null,
  skipped: false,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('useReminders', () => {
  it('loads reminders on mount', async () => {
    listRemindersMock.mockResolvedValue([reminder]);
    const { result } = renderHook(() => useReminders());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.reminders).toEqual([reminder]);
    expect(result.current.error).toBeNull();
  });

  it('sets an error message when loading fails', async () => {
    listRemindersMock.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('network down');
  });

  it('createReminder() calls the repository and refreshes', async () => {
    listRemindersMock.mockResolvedValueOnce([]).mockResolvedValueOnce([reminder]);
    createReminderMock.mockResolvedValue(reminder);
    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createReminder({ title: 'Renew passport', category: 'Personal', dueDate: '2026-08-16', priority: 'high' });
    });

    expect(createReminderMock).toHaveBeenCalled();
    expect(result.current.reminders).toEqual([reminder]);
  });

  it('toggleComplete() flips the completed flag for the given reminder', async () => {
    listRemindersMock.mockResolvedValue([reminder]);
    updateReminderMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleComplete('reminder-1');
    });

    expect(updateReminderMock).toHaveBeenCalledWith('reminder-1', { completed: true });
  });

  it('snooze() moves the due date forward by one day', async () => {
    listRemindersMock.mockResolvedValue([reminder]);
    updateReminderMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.snooze('reminder-1');
    });

    expect(updateReminderMock).toHaveBeenCalledWith('reminder-1', { dueDate: '2026-08-17' });
  });

  it('deleteReminder() surfaces a mutation error without crashing', async () => {
    listRemindersMock.mockResolvedValue([]);
    deleteReminderMock.mockRejectedValue(new Error('cannot delete'));
    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.deleteReminder('reminder-1')).rejects.toThrow('cannot delete');
    });

    expect(result.current.error).toBe('cannot delete');
  });

  it('ignores a stale in-flight request that rejects after a newer one already succeeded', async () => {
    let rejectFirst: (err: Error) => void = () => {};
    const firstCall = new Promise((_resolve, reject) => {
      rejectFirst = reject;
    });
    listRemindersMock.mockReturnValueOnce(firstCall).mockResolvedValueOnce([reminder]);

    const { result } = renderHook(() => useReminders());
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.reminders).toEqual([reminder]);

    await act(async () => {
      rejectFirst(new Error('stale failure'));
      await firstCall.catch(() => {});
    });

    expect(result.current.reminders).toEqual([reminder]);
    expect(result.current.error).toBeNull();
  });
});

describe('useReminders recurring behavior', () => {
  const recurringReminder = { ...reminder, id: 'reminder-2', seriesId: 'series-1', cycleNumber: 1, completed: false };

  it('toggleComplete() on a recurring reminder closes the cycle via closeReminderCycle, not a plain update', async () => {
    listRemindersMock.mockResolvedValue([recurringReminder]);
    closeReminderCycleMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleComplete('reminder-2');
    });

    expect(closeReminderCycleMock).toHaveBeenCalledWith('reminder-2', 'completed');
    expect(updateReminderMock).not.toHaveBeenCalled();
  });

  it('toggleComplete() un-completing a closed recurring reminder uses a plain update, not closeReminderCycle', async () => {
    listRemindersMock.mockResolvedValue([{ ...recurringReminder, completed: true }]);
    updateReminderMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleComplete('reminder-2');
    });

    expect(updateReminderMock).toHaveBeenCalledWith('reminder-2', { completed: false });
    expect(closeReminderCycleMock).not.toHaveBeenCalled();
  });

  it('skipCycle() closes the cycle as skipped', async () => {
    listRemindersMock.mockResolvedValue([recurringReminder]);
    closeReminderCycleMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.skipCycle('reminder-2');
    });

    expect(closeReminderCycleMock).toHaveBeenCalledWith('reminder-2', 'skipped');
  });

  it('createRecurringReminder() calls the repository and refreshes', async () => {
    listRemindersMock.mockResolvedValueOnce([]).mockResolvedValueOnce([recurringReminder]);
    createRecurringReminderMock.mockResolvedValue(recurringReminder);
    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createRecurringReminder(
        { title: 'Water plants', category: 'Home', dueDate: '2026-08-16', priority: 'low' },
        { frequency: 'weekly' }
      );
    });

    expect(createRecurringReminderMock).toHaveBeenCalledWith(
      { title: 'Water plants', category: 'Home', dueDate: '2026-08-16', priority: 'low' },
      { frequency: 'weekly' }
    );
    expect(result.current.reminders).toEqual([recurringReminder]);
  });

  it('ignores a second toggleComplete call for the same reminder while the first is still in flight', async () => {
    listRemindersMock.mockResolvedValue([recurringReminder]);
    let resolveClose: () => void = () => {};
    closeReminderCycleMock.mockReturnValue(new Promise<void>((resolve) => (resolveClose = resolve)));
    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let firstCall: Promise<void> = Promise.resolve();
    let secondCall: Promise<void> = Promise.resolve();
    await act(async () => {
      firstCall = result.current.toggleComplete('reminder-2');
      secondCall = result.current.toggleComplete('reminder-2');
      resolveClose();
      await Promise.all([firstCall, secondCall]);
    });

    expect(closeReminderCycleMock).toHaveBeenCalledTimes(1);
  });
});

describe('useReminders offline behavior', () => {
  afterEach(async () => {
    await resetDbForTests();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('kb-personals-offline');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });

  it('falls back to cached reminders when the list fetch fails with a network error', async () => {
    await cacheList('reminders', [reminder]);
    listRemindersMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.reminders).toEqual([reminder]);
    expect(result.current.error).toBeNull();
  });

  it('queues a create and applies an optimistic update when offline', async () => {
    listRemindersMock.mockResolvedValue([]);
    createReminderMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createReminder({ title: 'Water plants', category: 'Home', dueDate: '2026-09-01', priority: 'low' });
    });

    expect(result.current.reminders).toHaveLength(1);
    expect(result.current.reminders[0]).toMatchObject({ title: 'Water plants' });
    expect(result.current.pendingSyncIds.size).toBe(1);
    const queue = await getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].operation).toBe('createReminder');
  });
});
