'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listCategories,
  createCategory,
  updateCategory,
  archiveCategory,
  unarchiveCategory,
  deleteCategory,
  mergeCategories,
  reorderCategories,
} from './categories-repository';
import type { Category, CategoryIconKey } from './categories-types';
import { logActivity } from './audit-log-repository';

export interface UseCategoriesResult {
  categories: Category[];
  activeCategories: Category[];
  archivedCategories: Category[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (input: { name: string; icon: CategoryIconKey; colorSlot: number }) => Promise<void>;
  update: (id: string, patch: Partial<Pick<Category, 'name' | 'icon' | 'colorSlot'>>) => Promise<void>;
  archive: (id: string) => Promise<void>;
  unarchive: (id: string) => Promise<void>;
  remove: (id: string, reassignToId?: string) => Promise<void>;
  merge: (sourceId: string, targetId: string) => Promise<void>;
  reorder: (orderedIds: string[]) => Promise<void>;
}

export function useCategories(): UseCategoriesResult {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await listCategories();
      if (requestId !== requestIdRef.current) return; // a newer refresh already landed
      setCategories(result);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch-on-mount: the lint rule flags any effect that transitively sets
    // state, but loading data when a hook mounts is exactly what effects are for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const runMutation = useCallback(
    async (fn: () => Promise<unknown>) => {
      setError(null);
      try {
        await fn();
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Action failed';
        setError(message);
        throw err;
      }
    },
    [refresh]
  );

  return {
    categories,
    activeCategories: categories.filter((c) => !c.archived),
    archivedCategories: categories.filter((c) => c.archived),
    loading,
    error,
    refresh,
    create: (input) =>
      runMutation(() =>
        createCategory(input).then((created) => {
          logActivity({
            action: 'create',
            entityType: 'category',
            entityId: created.id,
            entityLabel: created.name,
            afterValue: { name: created.name, icon: created.icon, colorSlot: created.colorSlot },
          }).catch(() => {});
        })
      ),
    update: (id, patch) => {
      const before = categories.find((c) => c.id === id);
      return runMutation(() =>
        updateCategory(id, patch).then(() => {
          logActivity({
            action: 'update',
            entityType: 'category',
            entityId: id,
            entityLabel: patch.name ?? before?.name ?? 'Category',
            beforeValue: before ? { name: before.name, icon: before.icon, colorSlot: before.colorSlot } : null,
            afterValue: { ...before, ...patch },
          }).catch(() => {});
        })
      );
    },
    archive: (id) => {
      const before = categories.find((c) => c.id === id);
      return runMutation(() =>
        archiveCategory(id).then(() => {
          logActivity({
            action: 'archive',
            entityType: 'category',
            entityId: id,
            entityLabel: before?.name ?? 'Category',
            beforeValue: { archived: false },
            afterValue: { archived: true },
          }).catch(() => {});
        })
      );
    },
    unarchive: (id) => {
      const before = categories.find((c) => c.id === id);
      return runMutation(() =>
        unarchiveCategory(id).then(() => {
          logActivity({
            action: 'unarchive',
            entityType: 'category',
            entityId: id,
            entityLabel: before?.name ?? 'Category',
            beforeValue: { archived: true },
            afterValue: { archived: false },
          }).catch(() => {});
        })
      );
    },
    remove: (id, reassignToId) => {
      const before = categories.find((c) => c.id === id);
      return runMutation(() =>
        deleteCategory(id, reassignToId).then(() => {
          logActivity({
            action: 'delete',
            entityType: 'category',
            entityId: id,
            entityLabel: before?.name ?? 'Category',
            beforeValue: before ? { name: before.name, icon: before.icon, colorSlot: before.colorSlot } : null,
          }).catch(() => {});
        })
      );
    },
    merge: (sourceId, targetId) => {
      const source = categories.find((c) => c.id === sourceId);
      const target = categories.find((c) => c.id === targetId);
      return runMutation(() =>
        mergeCategories(sourceId, targetId).then(() => {
          logActivity({
            action: 'merge',
            entityType: 'category',
            entityId: sourceId,
            entityLabel: source?.name ?? 'Category',
            beforeValue: { name: source?.name ?? null },
            afterValue: { mergedInto: target?.name ?? null },
          }).catch(() => {});
        })
      );
    },
    reorder: (orderedIds) => runMutation(() => reorderCategories(orderedIds)),
  };
}
