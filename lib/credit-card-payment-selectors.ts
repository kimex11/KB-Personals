import type { CreditCardDue } from './accounts-types';
import type { CreditCardPayment } from './credit-card-payments-repository';

export function totalPaid(payments: CreditCardPayment[]): number {
  return payments.reduce((sum, payment) => sum + payment.amount, 0);
}

export function lastPaymentDate(payments: CreditCardPayment[]): string | null {
  return payments[0]?.paidAt ?? null;
}

// A card's statement balance is re-anchored (balanceAnchorAt reset) whenever
// it's edited directly, e.g. a new billing cycle. Payments made before that
// point applied to a superseded balance and must not double-count against
// the current one.
export function paymentsSinceAnchor(card: CreditCardDue, payments: CreditCardPayment[]): CreditCardPayment[] {
  return payments.filter((payment) => payment.paidAt >= card.balanceAnchorAt);
}

export function remainingCardBalance(card: CreditCardDue, payments: CreditCardPayment[]): number {
  return card.statementBalance - totalPaid(paymentsSinceAnchor(card, payments));
}

export function totalRemainingCardBalance(cards: CreditCardDue[], paymentsByCardId: Record<string, CreditCardPayment[]>): number {
  return cards.reduce((sum, card) => sum + remainingCardBalance(card, paymentsByCardId[card.id] ?? []), 0);
}
