import { createClient } from './supabase/client';
import type { Reminder, Priority } from './reminders-types';
import type { CreateSeriesInput } from './recurring-types';
import { createSeries, getSeries, incrementOccurrencesGenerated } from './recurring-series-repository';
import { computeNextOccurrence } from './recurring-generation';

interface ReminderRow {
  id: string;
  title: string;
  category: string;
  due_date: string;
  priority: string;
  completed: boolean;
  created_at: string;
  series_id: string | null;
  cycle_number: number | null;
  skipped: boolean;
}

function rowToReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    dueDate: row.due_date,
    priority: row.priority as Priority,
    completed: row.completed,
    seriesId: row.series_id,
    cycleNumber: row.cycle_number,
    skipped: row.skipped,
  };
}

export async function listReminders(): Promise<Reminder[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from('reminders').select('*').order('due_date', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as ReminderRow[]).map(rowToReminder);
}

export async function createReminder(input: { title: string; category: string; dueDate: string; priority: Priority }): Promise<Reminder> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('reminders')
    .insert({ title: input.title, category: input.category, due_date: input.dueDate, priority: input.priority })
    .select()
    .single();
  if (error) throw error;
  return rowToReminder(data as ReminderRow);
}

export async function createRecurringReminder(
  reminderInput: { title: string; category: string; dueDate: string; priority: Priority },
  seriesInput: Omit<CreateSeriesInput, 'entityType'>
): Promise<Reminder> {
  const series = await createSeries({ ...seriesInput, entityType: 'reminder' });
  const supabase = createClient();
  const { data, error } = await supabase
    .from('reminders')
    .insert({
      title: reminderInput.title,
      category: reminderInput.category,
      due_date: reminderInput.dueDate,
      priority: reminderInput.priority,
      series_id: series.id,
      cycle_number: 1,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToReminder(data as ReminderRow);
}

export async function updateReminder(
  id: string,
  patch: Partial<{ title: string; category: string; dueDate: string; priority: Priority; completed: boolean }>
): Promise<void> {
  const supabase = createClient();
  const payload: Record<string, unknown> = {};
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.category !== undefined) payload.category = patch.category;
  if (patch.dueDate !== undefined) payload.due_date = patch.dueDate;
  if (patch.priority !== undefined) payload.priority = patch.priority;
  if (patch.completed !== undefined) payload.completed = patch.completed;

  const { error } = await supabase.from('reminders').update(payload).eq('id', id);
  if (error) throw error;
}

export async function closeReminderCycle(id: string, action: 'completed' | 'skipped'): Promise<void> {
  const supabase = createClient();
  const { data: currentRow, error: fetchError } = await supabase.from('reminders').select('*').eq('id', id).single();
  if (fetchError) throw fetchError;
  const current = rowToReminder(currentRow as ReminderRow);

  const closePayload = action === 'completed' ? { completed: true } : { skipped: true };
  const { error: updateError } = await supabase.from('reminders').update(closePayload).eq('id', id);
  if (updateError) throw updateError;

  if (!current.seriesId || current.cycleNumber === null) return;

  const series = await getSeries(current.seriesId);
  const next = computeNextOccurrence({ dueDate: current.dueDate, cycleNumber: current.cycleNumber }, series);
  if (!next) return;

  const { error: insertError } = await supabase.from('reminders').insert({
    title: current.title,
    category: current.category,
    due_date: next.dueDate,
    priority: current.priority,
    series_id: current.seriesId,
    cycle_number: next.cycleNumber,
  });
  if (insertError) throw insertError;

  await incrementOccurrencesGenerated(current.seriesId, series.occurrencesGenerated + 1);
}

export async function deleteReminder(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('reminders').delete().eq('id', id);
  if (error) throw error;
}
