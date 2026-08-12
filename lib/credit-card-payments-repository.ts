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

export async function listAllCreditCardPayments(): Promise<CreditCardPayment[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from('credit_card_payments').select('*').order('paid_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as CreditCardPaymentRow[]).map(rowToPayment);
}

export interface RecordCardPaymentInput {
  amount: number;
  paidAt: string;
  method?: string | null;
  notes?: string | null;
}

export class DuplicatePaymentError extends Error {
  constructor() {
    super('This payment has already been recorded for this card.');
    this.name = 'DuplicatePaymentError';
  }
}

// The card's statement_balance is a fixed anchor (set on creation or whenever
// edited directly, e.g. a new billing cycle) — it is never mutated by
// recording a payment. The remaining balance is always the live sum of the
// ledger since that anchor, so editing or deleting a payment automatically
// recalculates it with no separate bookkeeping step.
export async function recordCardPayment(cardId: string, input: RecordCardPaymentInput): Promise<CreditCardPayment> {
  const supabase = createClient();

  const { data: cardData, error: cardError } = await supabase
    .from('credit_card_dues')
    .select('card_name, statement_balance, balance_anchor_at')
    .eq('id', cardId)
    .single();
  if (cardError) throw cardError;
  const cardRow = cardData as { card_name: string; statement_balance: number; balance_anchor_at: string };

  const existingPayments = await listPaymentsForCard(cardId);
  const isDuplicate = existingPayments.some((payment) => payment.amount === input.amount && payment.paidAt === input.paidAt);
  if (isDuplicate) throw new DuplicatePaymentError();

  const paidSinceAnchor = existingPayments
    .filter((payment) => payment.paidAt >= cardRow.balance_anchor_at)
    .reduce((sum, payment) => sum + payment.amount, 0);
  const balanceBefore = cardRow.statement_balance - paidSinceAnchor;
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

export interface UpdateCardPaymentInput {
  amount?: number;
  paidAt?: string;
  method?: string | null;
  notes?: string | null;
}

export async function updateCardPayment(id: string, patch: UpdateCardPaymentInput): Promise<void> {
  const supabase = createClient();
  const payload: Record<string, unknown> = {};
  if (patch.amount !== undefined) payload.amount = patch.amount;
  if (patch.paidAt !== undefined) payload.paid_at = patch.paidAt;
  if (patch.method !== undefined) payload.method = patch.method;
  if (patch.notes !== undefined) payload.notes = patch.notes;

  // Balance_after is a point-in-time snapshot for the trail display; keep it
  // self-consistent with a changed amount without touching balance_before
  // (the balance immediately prior to this payment didn't change) or any
  // other row (the current remaining balance is computed live from amounts).
  if (patch.amount !== undefined) {
    const { data, error: fetchError } = await supabase.from('credit_card_payments').select('balance_before').eq('id', id).single();
    if (fetchError) throw fetchError;
    const row = data as { balance_before: number };
    payload.balance_after = row.balance_before - patch.amount;
  }

  const { error } = await supabase.from('credit_card_payments').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteCardPayment(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('credit_card_payments').delete().eq('id', id);
  if (error) throw error;
}
