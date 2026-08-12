import { createClient } from './supabase/client';

export interface PaymentPlan {
  id: string;
  name: string;
  categoryId: string;
  category: string;
  categoryColorSlot: number;
  totalAmount: number;
  installmentCount: number;
  monthlyAmount: number;
  startDate: string;
}

interface PaymentPlanRow {
  id: string;
  name: string;
  category_id: string;
  total_amount: number;
  installment_count: number;
  monthly_amount: number;
  start_date: string;
  categories: { name: string; color_slot: number } | null;
}

function rowToPlan(row: PaymentPlanRow): PaymentPlan {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    category: row.categories?.name ?? '',
    categoryColorSlot: row.categories?.color_slot ?? 1,
    totalAmount: row.total_amount,
    installmentCount: row.installment_count,
    monthlyAmount: row.monthly_amount,
    startDate: row.start_date,
  };
}

export async function listPaymentPlans(): Promise<PaymentPlan[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('payment_plans')
    .select('*, categories(name, color_slot)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as PaymentPlanRow[]).map(rowToPlan);
}

export interface CreatePaymentPlanInput {
  name: string;
  categoryId: string;
  totalAmount: number;
  installmentCount: number;
  monthlyAmount: number;
  startDate: string;
}

export async function createPaymentPlan(input: CreatePaymentPlanInput): Promise<PaymentPlan> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('payment_plans')
    .insert({
      name: input.name,
      category_id: input.categoryId,
      total_amount: input.totalAmount,
      installment_count: input.installmentCount,
      monthly_amount: input.monthlyAmount,
      start_date: input.startDate,
    })
    .select('*, categories(name, color_slot)')
    .single();
  if (error) throw error;
  return rowToPlan(data as PaymentPlanRow);
}

export async function deletePaymentPlan(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('payment_plans').delete().eq('id', id);
  if (error) throw error;
}
