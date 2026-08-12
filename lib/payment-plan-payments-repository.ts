import { createClient } from './supabase/client';
import { logActivity } from './audit-log-repository';

export interface PaymentPlanPayment {
  id: string;
  planId: string;
  installmentNumber: number;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  paidAt: string;
}

interface PaymentPlanPaymentRow {
  id: string;
  plan_id: string;
  installment_number: number;
  amount: number;
  balance_before: number;
  balance_after: number;
  paid_at: string;
}

function rowToPayment(row: PaymentPlanPaymentRow): PaymentPlanPayment {
  return {
    id: row.id,
    planId: row.plan_id,
    installmentNumber: row.installment_number,
    amount: row.amount,
    balanceBefore: row.balance_before,
    balanceAfter: row.balance_after,
    paidAt: row.paid_at,
  };
}

export async function listPaymentsForPlan(planId: string): Promise<PaymentPlanPayment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('payment_plan_payments')
    .select('*')
    .eq('plan_id', planId)
    .order('paid_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as PaymentPlanPaymentRow[]).map(rowToPayment);
}

export async function listAllPlanPayments(): Promise<PaymentPlanPayment[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from('payment_plan_payments').select('*').order('paid_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as PaymentPlanPaymentRow[]).map(rowToPayment);
}

export interface RecordPlanPaymentInput {
  amount: number;
  paidAt: string;
}

export class DuplicatePlanPaymentError extends Error {
  constructor() {
    super('This payment has already been recorded for this plan.');
    this.name = 'DuplicatePlanPaymentError';
  }
}

export async function recordPlanPayment(planId: string, input: RecordPlanPaymentInput): Promise<PaymentPlanPayment> {
  const supabase = createClient();

  const { data: planData, error: planError } = await supabase
    .from('payment_plans')
    .select('name, total_amount')
    .eq('id', planId)
    .single();
  if (planError) throw planError;
  const planRow = planData as { name: string; total_amount: number };

  const existingPayments = await listPaymentsForPlan(planId);
  const isDuplicate = existingPayments.some((payment) => payment.amount === input.amount && payment.paidAt === input.paidAt);
  if (isDuplicate) throw new DuplicatePlanPaymentError();

  const totalPaidSoFar = existingPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const balanceBefore = planRow.total_amount - totalPaidSoFar;
  const balanceAfter = balanceBefore - input.amount;
  const installmentNumber = existingPayments.length + 1;

  const { data: paymentData, error: insertError } = await supabase
    .from('payment_plan_payments')
    .insert({
      plan_id: planId,
      installment_number: installmentNumber,
      amount: input.amount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      paid_at: input.paidAt,
    })
    .select()
    .single();
  if (insertError) throw insertError;

  logActivity({
    action: 'update',
    entityType: 'payment_plan',
    entityId: planId,
    entityLabel: planRow.name,
    beforeValue: { balanceBefore },
    afterValue: { balanceAfter, amountPaid: input.amount, installmentNumber },
  }).catch(() => {});

  return rowToPayment(paymentData as PaymentPlanPaymentRow);
}

export interface UpdatePlanPaymentInput {
  amount?: number;
  paidAt?: string;
}

export async function updatePlanPayment(id: string, patch: UpdatePlanPaymentInput): Promise<void> {
  const supabase = createClient();
  const payload: Record<string, unknown> = {};
  if (patch.amount !== undefined) payload.amount = patch.amount;
  if (patch.paidAt !== undefined) payload.paid_at = patch.paidAt;

  // balance_after is a point-in-time snapshot for the trail display; keep it
  // self-consistent with a changed amount. The plan's actual remaining
  // balance is always computed live from every payment's amount, so no
  // other row needs to change.
  if (patch.amount !== undefined) {
    const { data, error: fetchError } = await supabase.from('payment_plan_payments').select('balance_before').eq('id', id).single();
    if (fetchError) throw fetchError;
    const row = data as { balance_before: number };
    payload.balance_after = row.balance_before - patch.amount;
  }

  const { error } = await supabase.from('payment_plan_payments').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deletePlanPayment(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('payment_plan_payments').delete().eq('id', id);
  if (error) throw error;
}
