import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const { listExpensesMock, createExpenseMock, updateExpenseMock, deleteExpenseMock, logActivityMock } = vi.hoisted(() => ({
  listExpensesMock: vi.fn(),
  createExpenseMock: vi.fn(),
  updateExpenseMock: vi.fn(),
  deleteExpenseMock: vi.fn(),
  logActivityMock: vi.fn(),
}));

vi.mock('./expenses-repository', () => ({
  listExpenses: listExpensesMock,
  createExpense: createExpenseMock,
  updateExpense: updateExpenseMock,
  deleteExpense: deleteExpenseMock,
}));

vi.mock('./audit-log-repository', () => ({ logActivity: logActivityMock }));

import { useExpenses } from './use-expenses';

const expense = {
  id: 'exp-1', categoryId: 'cat-1', category: 'Groceries', categoryColorSlot: 2, amount: 850, date: '2026-08-12', description: 'Weekly run', paymentMethod: 'Cash',
};

afterEach(() => {
  vi.clearAllMocks();
});

beforeEach(() => {
  logActivityMock.mockResolvedValue(undefined);
});

describe('useExpenses', () => {
  it('loads expenses on mount', async () => {
    listExpensesMock.mockResolvedValue([expense]);
    const { result } = renderHook(() => useExpenses());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.expenses).toEqual([expense]);
    expect(result.current.error).toBeNull();
  });

  it('sets an error message when loading fails', async () => {
    listExpensesMock.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useExpenses());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('network down');
  });

  it('create() calls the repository, refreshes, and logs a create activity', async () => {
    listExpensesMock.mockResolvedValueOnce([]).mockResolvedValueOnce([expense]);
    createExpenseMock.mockResolvedValue(expense);
    const { result } = renderHook(() => useExpenses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.create({ categoryId: 'cat-1', amount: 850, date: '2026-08-12', description: 'Weekly run', paymentMethod: 'Cash' });
    });

    expect(createExpenseMock).toHaveBeenCalledWith({ categoryId: 'cat-1', amount: 850, date: '2026-08-12', description: 'Weekly run', paymentMethod: 'Cash' });
    expect(result.current.expenses).toEqual([expense]);
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', entityType: 'expense', entityId: 'exp-1', entityLabel: 'Weekly run' })
    );
  });

  it('update() logs an update activity with before and after snapshots', async () => {
    listExpensesMock.mockResolvedValue([expense]);
    updateExpenseMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useExpenses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.update('exp-1', { amount: 900 });
    });

    expect(updateExpenseMock).toHaveBeenCalledWith('exp-1', { amount: 900 });
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        entityType: 'expense',
        entityId: 'exp-1',
        beforeValue: expect.objectContaining({ amount: 850 }),
        afterValue: expect.objectContaining({ amount: 900 }),
      })
    );
  });

  it('remove() calls the repository, refreshes, and logs a delete activity', async () => {
    listExpensesMock.mockResolvedValue([expense]);
    deleteExpenseMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useExpenses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.remove('exp-1');
    });

    expect(deleteExpenseMock).toHaveBeenCalledWith('exp-1');
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delete', entityType: 'expense', entityId: 'exp-1', entityLabel: 'Weekly run' })
    );
  });

  it('surfaces a mutation error without crashing', async () => {
    listExpensesMock.mockResolvedValue([]);
    deleteExpenseMock.mockRejectedValue(new Error('cannot delete'));
    const { result } = renderHook(() => useExpenses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.remove('exp-1')).rejects.toThrow('cannot delete');
    });

    expect(result.current.error).toBe('cannot delete');
  });
});
