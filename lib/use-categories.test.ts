import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const { listCategoriesMock, createCategoryMock, archiveCategoryMock, reorderCategoriesMock } = vi.hoisted(() => ({
  listCategoriesMock: vi.fn(),
  createCategoryMock: vi.fn(),
  archiveCategoryMock: vi.fn(),
  reorderCategoriesMock: vi.fn(),
}));

vi.mock('./categories-repository', () => ({
  listCategories: listCategoriesMock,
  createCategory: createCategoryMock,
  updateCategory: vi.fn(),
  archiveCategory: archiveCategoryMock,
  unarchiveCategory: vi.fn(),
  deleteCategory: vi.fn(),
  mergeCategories: vi.fn(),
  reorderCategories: reorderCategoriesMock,
}));

import { useCategories } from './use-categories';

const activeCategory = {
  id: 'cat-1',
  name: 'Housing',
  icon: 'building-2',
  colorSlot: 1,
  sortOrder: 0,
  archived: false,
  createdAt: '2026-08-15T10:00:00.000Z',
};
const archivedCategory = {
  id: 'cat-2',
  name: 'Old',
  icon: 'gift',
  colorSlot: 2,
  sortOrder: 1,
  archived: true,
  createdAt: '2026-08-15T10:00:00.000Z',
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('useCategories', () => {
  it('loads categories on mount and splits active/archived', async () => {
    listCategoriesMock.mockResolvedValue([activeCategory, archivedCategory]);
    const { result } = renderHook(() => useCategories());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.categories).toHaveLength(2);
    expect(result.current.activeCategories).toEqual([activeCategory]);
    expect(result.current.archivedCategories).toEqual([archivedCategory]);
    expect(result.current.error).toBeNull();
  });

  it('sets an error message when loading fails', async () => {
    listCategoriesMock.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('network down');
  });

  it('create() calls the repository and refreshes the list', async () => {
    listCategoriesMock.mockResolvedValueOnce([]).mockResolvedValueOnce([activeCategory]);
    createCategoryMock.mockResolvedValue(activeCategory);
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.create({ name: 'Housing', icon: 'building-2', colorSlot: 1 });
    });

    expect(createCategoryMock).toHaveBeenCalledWith({ name: 'Housing', icon: 'building-2', colorSlot: 1 });
    expect(result.current.categories).toEqual([activeCategory]);
  });

  it('surfaces a mutation error without crashing', async () => {
    listCategoriesMock.mockResolvedValue([]);
    archiveCategoryMock.mockRejectedValue(new Error('cannot archive'));
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.archive('cat-1')).rejects.toThrow('cannot archive');
    });

    expect(result.current.error).toBe('cannot archive');
  });

  it('reorder() calls the repository with the given id order', async () => {
    listCategoriesMock.mockResolvedValue([]);
    reorderCategoriesMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.reorder(['cat-2', 'cat-1']);
    });

    expect(reorderCategoriesMock).toHaveBeenCalledWith(['cat-2', 'cat-1']);
  });

  it('ignores a stale in-flight request that rejects after a newer one already succeeded', async () => {
    let rejectFirst: (err: Error) => void = () => {};
    const firstCall = new Promise((_resolve, reject) => {
      rejectFirst = reject;
    });
    listCategoriesMock.mockReturnValueOnce(firstCall).mockResolvedValueOnce([activeCategory]);

    const { result } = renderHook(() => useCategories());
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.categories).toEqual([activeCategory]);

    await act(async () => {
      rejectFirst(new Error('stale failure'));
      await firstCall.catch(() => {});
    });

    expect(result.current.categories).toEqual([activeCategory]);
    expect(result.current.error).toBeNull();
  });
});
