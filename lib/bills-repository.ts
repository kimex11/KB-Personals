import { createClient } from './supabase/client';
import type { Bill, RecurrenceInterval } from './bills-types';

interface BillRow {
  id: string;
  title: string;
  category_id: string;
  amount: number;
  due_date: string;
  recurrence: string | null;
  paid: boolean;
  created_at: string;
  categories: { name: string } | null;
}

interface BillWithCategoryId extends Bill {
  categoryId: string;
}

function rowToBill(row: BillRow): BillWithCategoryId {
  return {
    id: row.id,
    title: row.title,
    category: row.categories?.name ?? '',
    categoryId: row.category_id,
    amount: row.amount,
    dueDate: row.due_date,
    recurrence: row.recurrence as RecurrenceInterval,
    paid: row.paid,
  };
}

export async function listBills(): Promise<BillWithCategoryId[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('bills')
    .select('*, categories(name)')
    .order('due_date', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as BillRow[]).map(rowToBill);
}

export async function createBill(input: {
  title: string;
  categoryId: string;
  amount: number;
  dueDate: string;
  recurrence: RecurrenceInterval;
}): Promise<BillWithCategoryId> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('bills')
    .insert({
      title: input.title,
      category_id: input.categoryId,
      amount: input.amount,
      due_date: input.dueDate,
      recurrence: input.recurrence,
    })
    .select('*, categories(name)')
    .single();
  if (error) throw error;
  return rowToBill(data as BillRow);
}

export async function updateBill(
  id: string,
  patch: Partial<{ title: string; categoryId: string; amount: number; dueDate: string; recurrence: RecurrenceInterval; paid: boolean }>
): Promise<void> {
  const supabase = createClient();
  const payload: Record<string, unknown> = {};
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.categoryId !== undefined) payload.category_id = patch.categoryId;
  if (patch.amount !== undefined) payload.amount = patch.amount;
  if (patch.dueDate !== undefined) payload.due_date = patch.dueDate;
  if (patch.recurrence !== undefined) payload.recurrence = patch.recurrence;
  if (patch.paid !== undefined) payload.paid = patch.paid;

  const { error } = await supabase.from('bills').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteBill(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('bills').delete().eq('id', id);
  if (error) throw error;
}
