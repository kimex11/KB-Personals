import { createClient } from './supabase/client';
import type { CreditCardDue, IncomeSource } from './accounts-types';

interface CardRow {
  id: string;
  card_name: string;
  last4: string;
  statement_balance: number;
  minimum_payment: number;
  due_date: string;
  created_at: string;
}

interface IncomeRow {
  id: string;
  name: string;
  amount: number;
  date: string;
  created_at: string;
}

function rowToCard(row: CardRow): CreditCardDue {
  return {
    id: row.id,
    cardName: row.card_name,
    last4: row.last4,
    statementBalance: row.statement_balance,
    minimumPayment: row.minimum_payment,
    dueDate: row.due_date,
  };
}

function rowToIncome(row: IncomeRow): IncomeSource {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    date: row.date,
  };
}

export async function listCreditCardDues(): Promise<CreditCardDue[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from('credit_card_dues').select('*').order('due_date', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as CardRow[]).map(rowToCard);
}

export async function createCreditCardDue(input: {
  cardName: string;
  last4: string;
  statementBalance: number;
  minimumPayment: number;
  dueDate: string;
}): Promise<CreditCardDue> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('credit_card_dues')
    .insert({
      card_name: input.cardName,
      last4: input.last4,
      statement_balance: input.statementBalance,
      minimum_payment: input.minimumPayment,
      due_date: input.dueDate,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToCard(data as CardRow);
}

export async function updateCreditCardDue(
  id: string,
  patch: Partial<Pick<CreditCardDue, 'cardName' | 'last4' | 'statementBalance' | 'minimumPayment' | 'dueDate'>>
): Promise<void> {
  const supabase = createClient();
  const payload: Record<string, unknown> = {};
  if (patch.cardName !== undefined) payload.card_name = patch.cardName;
  if (patch.last4 !== undefined) payload.last4 = patch.last4;
  if (patch.statementBalance !== undefined) payload.statement_balance = patch.statementBalance;
  if (patch.minimumPayment !== undefined) payload.minimum_payment = patch.minimumPayment;
  if (patch.dueDate !== undefined) payload.due_date = patch.dueDate;

  const { error } = await supabase.from('credit_card_dues').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteCreditCardDue(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('credit_card_dues').delete().eq('id', id);
  if (error) throw error;
}

export async function listIncomeSources(): Promise<IncomeSource[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from('income_sources').select('*').order('date', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as IncomeRow[]).map(rowToIncome);
}

export async function createIncomeSource(input: { name: string; amount: number; date: string }): Promise<IncomeSource> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('income_sources')
    .insert({ name: input.name, amount: input.amount, date: input.date })
    .select()
    .single();
  if (error) throw error;
  return rowToIncome(data as IncomeRow);
}

export async function updateIncomeSource(id: string, patch: Partial<Pick<IncomeSource, 'name' | 'amount' | 'date'>>): Promise<void> {
  const supabase = createClient();
  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.amount !== undefined) payload.amount = patch.amount;
  if (patch.date !== undefined) payload.date = patch.date;

  const { error } = await supabase.from('income_sources').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteIncomeSource(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('income_sources').delete().eq('id', id);
  if (error) throw error;
}
