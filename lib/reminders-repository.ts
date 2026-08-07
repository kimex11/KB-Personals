import { createClient } from './supabase/client';
import type { Reminder, Priority } from './reminders-types';

interface ReminderRow {
  id: string;
  title: string;
  category: string;
  due_date: string;
  priority: string;
  completed: boolean;
  created_at: string;
}

function rowToReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    dueDate: row.due_date,
    priority: row.priority as Priority,
    completed: row.completed,
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

export async function deleteReminder(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('reminders').delete().eq('id', id);
  if (error) throw error;
}
