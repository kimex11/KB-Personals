import { createClient } from './supabase/client';
import type { Category, CategoryIconKey } from './categories-types';

const RELATION_MISSING_CODE = '42P01';

interface CategoryRow {
  id: string;
  name: string;
  icon: string;
  color_slot: number;
  sort_order: number;
  archived: boolean;
  created_at: string;
}

function rowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon as CategoryIconKey,
    colorSlot: row.color_slot,
    sortOrder: row.sort_order,
    archived: row.archived,
    createdAt: row.created_at,
  };
}

export async function listCategories(): Promise<Category[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from('categories').select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as CategoryRow[]).map(rowToCategory);
}

export async function createCategory(input: { name: string; icon: CategoryIconKey; colorSlot: number }): Promise<Category> {
  const existing = await listCategories();
  const nextSortOrder = existing.length > 0 ? Math.max(...existing.map((c) => c.sortOrder)) + 1 : 0;

  const supabase = createClient();
  const { data, error } = await supabase
    .from('categories')
    .insert({ name: input.name, icon: input.icon, color_slot: input.colorSlot, sort_order: nextSortOrder })
    .select()
    .single();
  if (error) throw error;
  return rowToCategory(data as CategoryRow);
}

export async function updateCategory(
  id: string,
  patch: Partial<Pick<Category, 'name' | 'icon' | 'colorSlot'>>
): Promise<void> {
  const supabase = createClient();
  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.icon !== undefined) payload.icon = patch.icon;
  if (patch.colorSlot !== undefined) payload.color_slot = patch.colorSlot;

  const { error } = await supabase.from('categories').update(payload).eq('id', id);
  if (error) throw error;
}

export async function archiveCategory(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('categories').update({ archived: true }).eq('id', id);
  if (error) throw error;
}

export async function unarchiveCategory(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('categories').update({ archived: false }).eq('id', id);
  if (error) throw error;
}

export async function countBillsUsingCategory(categoryId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase.from('bills').select('id', { count: 'exact', head: true }).eq('category_id', categoryId);
  if (error) {
    if ((error as { code?: string }).code === RELATION_MISSING_CODE) return 0;
    throw error;
  }
  return count ?? 0;
}

export async function deleteCategory(id: string, reassignToId?: string): Promise<void> {
  const supabase = createClient();
  if (reassignToId) {
    const { error: reassignError } = await supabase.from('bills').update({ category_id: reassignToId }).eq('category_id', id);
    if (reassignError && (reassignError as { code?: string }).code !== RELATION_MISSING_CODE) throw reassignError;
  }
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

export async function mergeCategories(sourceId: string, targetId: string): Promise<void> {
  const supabase = createClient();
  const { error: reassignError } = await supabase.from('bills').update({ category_id: targetId }).eq('category_id', sourceId);
  if (reassignError && (reassignError as { code?: string }).code !== RELATION_MISSING_CODE) throw reassignError;
  const { error } = await supabase.from('categories').delete().eq('id', sourceId);
  if (error) throw error;
}

export async function reorderCategories(orderedIds: string[]): Promise<void> {
  const supabase = createClient();
  const results = await Promise.all(
    orderedIds.map((id, index) => supabase.from('categories').update({ sort_order: index }).eq('id', id))
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}
