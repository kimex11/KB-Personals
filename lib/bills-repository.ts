import { createClient } from './supabase/client';
import type { Bill, RecurrenceInterval } from './bills-types';
import type { CreateSeriesInput } from './recurring-types';
import { createSeries, getSeries, incrementOccurrencesGenerated } from './recurring-series-repository';
import { computeNextOccurrence } from './recurring-generation';

interface BillRow {
  id: string;
  title: string;
  category_id: string;
  amount: number;
  due_date: string;
  recurrence: string | null;
  paid: boolean;
  created_at: string;
  categories: { name: string; color_slot: number } | null;
  series_id: string | null;
  cycle_number: number | null;
  skipped: boolean;
}

export interface BillWithCategoryId extends Bill {
  categoryId: string;
}

function rowToBill(row: BillRow): BillWithCategoryId {
  return {
    id: row.id,
    title: row.title,
    category: row.categories?.name ?? '',
    categoryColorSlot: row.categories?.color_slot,
    categoryId: row.category_id,
    amount: row.amount,
    dueDate: row.due_date,
    recurrence: row.recurrence as RecurrenceInterval,
    paid: row.paid,
    seriesId: row.series_id,
    cycleNumber: row.cycle_number,
    skipped: row.skipped,
  };
}

export async function listBills(): Promise<BillWithCategoryId[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('bills')
    .select('*, categories(name, color_slot)')
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
    .select('*, categories(name, color_slot)')
    .single();
  if (error) throw error;
  return rowToBill(data as BillRow);
}

export async function createRecurringBill(
  billInput: { title: string; categoryId: string; amount: number; dueDate: string },
  seriesInput: Omit<CreateSeriesInput, 'entityType'>
): Promise<BillWithCategoryId> {
  const series = await createSeries({ ...seriesInput, entityType: 'bill' });
  const supabase = createClient();
  const { data, error } = await supabase
    .from('bills')
    .insert({
      title: billInput.title,
      category_id: billInput.categoryId,
      amount: billInput.amount,
      due_date: billInput.dueDate,
      recurrence: null,
      series_id: series.id,
      cycle_number: 1,
    })
    .select('*, categories(name, color_slot)')
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

export async function closeBillCycle(id: string, action: 'paid' | 'skipped'): Promise<void> {
  const supabase = createClient();
  const { data: currentRow, error: fetchError } = await supabase.from('bills').select('*, categories(name, color_slot)').eq('id', id).single();
  if (fetchError) throw fetchError;
  const current = rowToBill(currentRow as BillRow);

  const closePayload = action === 'paid' ? { paid: true } : { skipped: true };
  const { error: updateError } = await supabase.from('bills').update(closePayload).eq('id', id);
  if (updateError) throw updateError;

  if (!current.seriesId || current.cycleNumber === null) return;

  const series = await getSeries(current.seriesId);
  const next = computeNextOccurrence({ dueDate: current.dueDate, cycleNumber: current.cycleNumber }, series);
  if (!next) return;

  const { error: insertError } = await supabase.from('bills').insert({
    title: current.title,
    category_id: current.categoryId,
    amount: current.amount,
    due_date: next.dueDate,
    recurrence: null,
    series_id: current.seriesId,
    cycle_number: next.cycleNumber,
  });
  if (insertError) throw insertError;

  await incrementOccurrencesGenerated(current.seriesId, series.occurrencesGenerated + 1);
}

export async function deleteBill(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('bills').delete().eq('id', id);
  if (error) throw error;
}
