import type { CreditCardPayment } from './credit-card-payments-repository';

export function totalPaid(payments: CreditCardPayment[]): number {
  return payments.reduce((sum, payment) => sum + payment.amount, 0);
}

export function lastPaymentDate(payments: CreditCardPayment[]): string | null {
  return payments[0]?.paidAt ?? null;
}
