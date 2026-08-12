import { createClient } from './supabase/client';

export interface Expense {
  id: string;
  categoryId: string;
  category: string;
  categoryColorSlot: number;
  amount: number;
  date: string;
  description: string | null;
  paymentMethod: string | null;
}

interface ExpenseRow {
  id: string;
  category_id: string;
  amount: number;
  expense_date: string;
  description: string | null;
  payment_method: string | null;
  categories: { name: string; color_slot: number } | null;
}

function rowToExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    categoryId: row.category_id,
    category: row.categories?.name ?? '',
    categoryColorSlot: row.categories?.color_slot ?? 1,
    amount: row.amount,
    date: row.expense_date,
    description: row.description,
    paymentMethod: row.payment_method,
  };
}

export async function listExpenses(): Promise<Expense[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('expenses')
    .select('*, categories(name, color_slot)')
    .order('expense_date', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as ExpenseRow[]).map(rowToExpense);
}

export interface CreateExpenseInput {
  categoryId: string;
  amount: number;
  date: string;
  description?: string | null;
  paymentMethod?: string | null;
}

export async function createExpense(input: CreateExpenseInput): Promise<Expense> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      category_id: input.categoryId,
      amount: input.amount,
      expense_date: input.date,
      description: input.description ?? null,
      payment_method: input.paymentMethod ?? null,
    })
    .select('*, categories(name, color_slot)')
    .single();
  if (error) throw error;
  return rowToExpense(data as ExpenseRow);
}

export async function updateExpense(
  id: string,
  patch: Partial<{ categoryId: string; amount: number; date: string; description: string | null; paymentMethod: string | null }>
): Promise<void> {
  const supabase = createClient();
  const payload: Record<string, unknown> = {};
  if (patch.categoryId !== undefined) payload.category_id = patch.categoryId;
  if (patch.amount !== undefined) payload.amount = patch.amount;
  if (patch.date !== undefined) payload.expense_date = patch.date;
  if (patch.description !== undefined) payload.description = patch.description;
  if (patch.paymentMethod !== undefined) payload.payment_method = patch.paymentMethod;

  const { error } = await supabase.from('expenses').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteExpense(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
}
