import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  listCategories,
  createCategory,
  updateCategory,
  archiveCategory,
  unarchiveCategory,
  countBillsUsingCategory,
  deleteCategory,
  mergeCategories,
  reorderCategories,
} from './categories-repository';

const selectOrderMock = vi.fn();
const insertSelectSingleMock = vi.fn();
const insertMock = vi.fn(() => ({ select: () => ({ single: insertSelectSingleMock }) }));
const categoriesUpdateEqMock = vi.fn();
const categoriesUpdateMock = vi.fn(() => ({ eq: categoriesUpdateEqMock }));
const categoriesDeleteEqMock = vi.fn();
const categoriesDeleteMock = vi.fn(() => ({ eq: categoriesDeleteEqMock }));
const billsCountEqMock = vi.fn();
const billsSelectMock = vi.fn(() => ({ eq: billsCountEqMock }));
const billsUpdateEqMock = vi.fn();
const billsUpdateMock = vi.fn(() => ({ eq: billsUpdateEqMock }));

vi.mock('./supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'bills') {
        return { select: billsSelectMock, update: billsUpdateMock };
      }
      if (table !== 'categories') throw new Error(`Unexpected table: ${table}`);
      return {
        select: () => ({ order: selectOrderMock }),
        insert: insertMock,
        update: categoriesUpdateMock,
        delete: categoriesDeleteMock,
      };
    },
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const row1 = { id: 'cat-1', name: 'Housing', icon: 'building-2', color_slot: 1, sort_order: 0, archived: false, created_at: '2026-08-15T10:00:00.000Z' };
const row2 = { id: 'cat-2', name: 'Groceries', icon: 'shopping-cart', color_slot: 2, sort_order: 1, archived: false, created_at: '2026-08-15T10:00:00.000Z' };

describe('listCategories', () => {
  it('returns categories ordered by sort_order', async () => {
    selectOrderMock.mockResolvedValue({ data: [row1], error: null });
    const result = await listCategories();
    expect(result).toEqual([
      { id: 'cat-1', name: 'Housing', icon: 'building-2', colorSlot: 1, sortOrder: 0, archived: false, createdAt: '2026-08-15T10:00:00.000Z' },
    ]);
  });

  it('throws on error', async () => {
    selectOrderMock.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(listCategories()).rejects.toThrow('boom');
  });
});

describe('createCategory', () => {
  it('appends at the end of the existing sort order', async () => {
    selectOrderMock.mockResolvedValue({ data: [row1, row2], error: null });
    insertSelectSingleMock.mockResolvedValue({
      data: { id: 'cat-3', name: 'Pet Care', icon: 'paw-print', color_slot: 9, sort_order: 2, archived: false, created_at: '2026-08-15T10:00:00.000Z' },
      error: null,
    });

    const result = await createCategory({ name: 'Pet Care', icon: 'paw-print', colorSlot: 9 });

    expect(insertMock).toHaveBeenCalledWith({ name: 'Pet Care', icon: 'paw-print', color_slot: 9, sort_order: 2 });
    expect(result).toEqual({ id: 'cat-3', name: 'Pet Care', icon: 'paw-print', colorSlot: 9, sortOrder: 2, archived: false, createdAt: '2026-08-15T10:00:00.000Z' });
  });

  it('uses sort order 0 when there are no existing categories', async () => {
    selectOrderMock.mockResolvedValue({ data: [], error: null });
    insertSelectSingleMock.mockResolvedValue({
      data: { id: 'cat-1', name: 'Housing', icon: 'building-2', color_slot: 1, sort_order: 0, archived: false, created_at: '2026-08-15T10:00:00.000Z' },
      error: null,
    });

    await createCategory({ name: 'Housing', icon: 'building-2', colorSlot: 1 });

    expect(insertMock).toHaveBeenCalledWith({ name: 'Housing', icon: 'building-2', color_slot: 1, sort_order: 0 });
  });
});

describe('updateCategory', () => {
  it('updates only the provided fields', async () => {
    categoriesUpdateEqMock.mockResolvedValue({ error: null });
    await updateCategory('cat-1', { name: 'Rent' });
    expect(categoriesUpdateMock).toHaveBeenCalledWith({ name: 'Rent' });
    expect(categoriesUpdateEqMock).toHaveBeenCalledWith('id', 'cat-1');
  });

  it('throws on error', async () => {
    categoriesUpdateEqMock.mockResolvedValue({ error: new Error('boom') });
    await expect(updateCategory('cat-1', { name: 'Rent' })).rejects.toThrow('boom');
  });
});

describe('archiveCategory / unarchiveCategory', () => {
  it('archives by setting archived to true', async () => {
    categoriesUpdateEqMock.mockResolvedValue({ error: null });
    await archiveCategory('cat-1');
    expect(categoriesUpdateMock).toHaveBeenCalledWith({ archived: true });
  });

  it('unarchives by setting archived to false', async () => {
    categoriesUpdateEqMock.mockResolvedValue({ error: null });
    await unarchiveCategory('cat-1');
    expect(categoriesUpdateMock).toHaveBeenCalledWith({ archived: false });
  });
});

describe('countBillsUsingCategory', () => {
  it('returns the count when the bills table exists', async () => {
    billsCountEqMock.mockResolvedValue({ count: 3, error: null });
    expect(await countBillsUsingCategory('cat-1')).toBe(3);
    expect(billsSelectMock).toHaveBeenCalledWith('id', { count: 'exact', head: true });
  });

  it('returns 0 when the bills table does not exist yet', async () => {
    billsCountEqMock.mockResolvedValue({ count: null, error: { code: '42P01', message: 'relation "bills" does not exist' } });
    expect(await countBillsUsingCategory('cat-1')).toBe(0);
  });

  it('rethrows other errors', async () => {
    billsCountEqMock.mockResolvedValue({ count: null, error: { code: 'XX000', message: 'boom' } });
    await expect(countBillsUsingCategory('cat-1')).rejects.toThrow('boom');
  });
});

describe('deleteCategory', () => {
  it('deletes without reassigning when no reassignToId is given', async () => {
    categoriesDeleteEqMock.mockResolvedValue({ error: null });
    await deleteCategory('cat-1');
    expect(billsUpdateMock).not.toHaveBeenCalled();
    expect(categoriesDeleteEqMock).toHaveBeenCalledWith('id', 'cat-1');
  });

  it('reassigns bills before deleting when reassignToId is given', async () => {
    billsUpdateEqMock.mockResolvedValue({ error: null });
    categoriesDeleteEqMock.mockResolvedValue({ error: null });
    await deleteCategory('cat-1', 'cat-2');
    expect(billsUpdateMock).toHaveBeenCalledWith({ category_id: 'cat-2' });
    expect(billsUpdateEqMock).toHaveBeenCalledWith('category_id', 'cat-1');
    expect(categoriesDeleteEqMock).toHaveBeenCalledWith('id', 'cat-1');
  });

  it('swallows a missing-bills-table error during reassignment and still deletes', async () => {
    billsUpdateEqMock.mockResolvedValue({ error: { code: '42P01', message: 'relation "bills" does not exist' } });
    categoriesDeleteEqMock.mockResolvedValue({ error: null });
    await deleteCategory('cat-1', 'cat-2');
    expect(categoriesDeleteEqMock).toHaveBeenCalledWith('id', 'cat-1');
  });
});

describe('mergeCategories', () => {
  it('reassigns bills from source to target then deletes source', async () => {
    billsUpdateEqMock.mockResolvedValue({ error: null });
    categoriesDeleteEqMock.mockResolvedValue({ error: null });
    await mergeCategories('cat-1', 'cat-2');
    expect(billsUpdateMock).toHaveBeenCalledWith({ category_id: 'cat-2' });
    expect(billsUpdateEqMock).toHaveBeenCalledWith('category_id', 'cat-1');
    expect(categoriesDeleteEqMock).toHaveBeenCalledWith('id', 'cat-1');
  });
});

describe('reorderCategories', () => {
  it('updates sort_order for each id to match its array index', async () => {
    categoriesUpdateEqMock.mockResolvedValue({ error: null });
    await reorderCategories(['cat-2', 'cat-1']);
    expect(categoriesUpdateMock).toHaveBeenCalledWith({ sort_order: 0 });
    expect(categoriesUpdateEqMock).toHaveBeenCalledWith('id', 'cat-2');
    expect(categoriesUpdateMock).toHaveBeenCalledWith({ sort_order: 1 });
    expect(categoriesUpdateEqMock).toHaveBeenCalledWith('id', 'cat-1');
  });
});
