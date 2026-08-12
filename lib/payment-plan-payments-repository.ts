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
