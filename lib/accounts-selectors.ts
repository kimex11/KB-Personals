import type { CreditCardDue, IncomeSource, DueStatus } from './accounts-types';
import { getDueDateStatus } from './date-utils';

const DUE_SOON_WINDOW_DAYS = 3;

export function getDueStatus(card: CreditCardDue, referenceDate: Date = new Date()): DueStatus {
  return getDueDateStatus(card.dueDate, referenceDate, DUE_SOON_WINDOW_DAYS);
}

export function totalIncome(sources: IncomeSource[]): number {
  return sources.reduce((sum, source) => sum + source.amount, 0);
}
