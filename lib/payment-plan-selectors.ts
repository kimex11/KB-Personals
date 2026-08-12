import type { PaymentPlan } from './payment-plans-repository';
import type { PaymentPlanPayment } from './payment-plan-payments-repository';

export function totalPaidForPlan(payments: PaymentPlanPayment[]): number {
  return payments.reduce((sum, payment) => sum + payment.amount, 0);
}

export function remainingBalance(plan: PaymentPlan, payments: PaymentPlanPayment[]): number {
  return plan.totalAmount - totalPaidForPlan(payments);
}

export function monthsPaid(payments: PaymentPlanPayment[]): number {
  return payments.length;
}

export function monthsLeft(plan: PaymentPlan, payments: PaymentPlanPayment[]): number {
  return Math.max(plan.installmentCount - payments.length, 0);
}

export function lastPlanPaymentDate(payments: PaymentPlanPayment[]): string | null {
  return payments[0]?.paidAt ?? null;
}

export function isPlanFullyPaid(plan: PaymentPlan, payments: PaymentPlanPayment[]): boolean {
  return remainingBalance(plan, payments) <= 0;
}
