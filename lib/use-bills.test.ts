import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const { listBillsMock, createBillMock, updateBillMock, deleteBillMock } = vi.hoisted(() => ({
  listBillsMock: vi.fn(),
  createBillMock: vi.fn(),
  updateBillMock: vi.fn(),
  deleteBillMock: vi.fn(),
}));

vi.mock('./bills-repository', () => ({
  listBills: listBillsMock,
  createBill: createBillMock,
  updateBill: updateBillMock,
  deleteBill: deleteBillMock,
}));

import { useBills } from './use-bills';

const bill = { id: 'bill-1', title: 'Rent', category: 'Housing', categoryId: 'cat-1', amount: 1450, dueDate: '2026-08-16', recurrence: 'monthly' as const, paid: false };

afterEach(() => {
  vi.clearAllMocks();
});

describe('useBills', () => {
  it('loads bills on mount', async () => {
    listBillsMock.mockResolvedValue([bill]);
    const { result } = renderHook(() => useBills());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.bills).toEqual([bill]);
    expect(result.current.error).toBeNull();
  });

  it('sets an error message when loading fails', async () => {
    listBillsMock.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('network down');
  });

  it('createBill() calls the repository and refreshes', async () => {
    listBillsMock.mockResolvedValueOnce([]).mockResolvedValueOnce([bill]);
    createBillMock.mockResolvedValue(bill);
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createBill({ title: 'Rent', categoryId: 'cat-1', amount: 1450, dueDate: '2026-08-16', recurrence: 'monthly' });
    });

    expect(createBillMock).toHaveBeenCalled();
    expect(result.current.bills).toEqual([bill]);
  });

  it('togglePaid() flips the paid flag for the given bill', async () => {
    listBillsMock.mockResolvedValue([bill]);
    updateBillMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.togglePaid('bill-1');
    });

    expect(updateBillMock).toHaveBeenCalledWith('bill-1', { paid: true });
  });

  it('deleteBill() surfaces a mutation error without crashing', async () => {
    listBillsMock.mockResolvedValue([]);
    deleteBillMock.mockRejectedValue(new Error('cannot delete'));
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.deleteBill('bill-1')).rejects.toThrow('cannot delete');
    });

    expect(result.current.error).toBe('cannot delete');
  });
});
