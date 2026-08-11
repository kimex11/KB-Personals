import { createClient } from './supabase/client';
import { logActivity } from './audit-log-repository';

export interface CreditCardPayment {
  id: string;
  cardId: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  paidAt: string;
  method: string | null;
  notes: string | null;
}

interface CreditCardPaymentRow {
  id: string;
  card_id: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  paid_at: string;
  method: string | null;
  notes: string | null;
}

function rowToPayment(row: CreditCardPaymentRow): CreditCardPayment {
  return {
    id: row.id,
    cardId: row.card_id,
    amount: row.amount,
    balanceBefore: row.balance_before,
    balanceAfter: row.balance_after,
    paidAt: row.paid_at,
    method: row.method,
    notes: row.notes,
  };
}

export async function listPaymentsForCard(cardId: string): Promise<CreditCardPayment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('credit_card_payments')
    .select('*')
    .eq('card_id', cardId)
    .order('paid_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as CreditCardPaymentRow[]).map(rowToPayment);
}

export interface RecordCardPaymentInput {
  amount: number;
  paidAt: string;
  method?: string | null;
  notes?: string | null;
}

export async function recordCardPayment(cardId: string, input: RecordCardPaymentInput): Promise<CreditCardPayment> {
  const supabase = createClient();

  const { data: cardData, error: cardError } = await supabase
    .from('credit_card_dues')
    .select('card_name, statement_balance')
    .eq('id', cardId)
    .single();
  if (cardError) throw cardError;

  const cardRow = cardData as { card_name: string; statement_balance: number };
  const balanceBefore = cardRow.statement_balance;
  const balanceAfter = balanceBefore - input.amount;

  const { data: paymentData, error: insertError } = await supabase
    .from('credit_card_payments')
    .insert({
      card_id: cardId,
      amount: input.amount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      paid_at: input.paidAt,
      method: input.method ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (insertError) throw insertError;

  const { error: updateError } = await supabase
    .from('credit_card_dues')
    .update({ statement_balance: balanceAfter })
    .eq('id', cardId);
  if (updateError) throw updateError;

  logActivity({
    action: 'update',
    entityType: 'credit_card_due',
    entityId: cardId,
    entityLabel: cardRow.card_name,
    beforeValue: { statementBalance: balanceBefore },
    afterValue: { statementBalance: balanceAfter, amountPaid: input.amount },
  }).catch(() => {});

  return rowToPayment(paymentData as CreditCardPaymentRow);
}
