import type { CreditCardDue, IncomeSource, DueStatus } from './accounts-types';
import { getDueDateStatus } from './date-utils';

const DUE_SOON_WINDOW_DAYS = 3;

const MONTHLY_MULTIPLIER: Record<IncomeSource['frequency'], number> = {
  weekly: 4.33,
  biweekly: 2.166,
  monthly: 1,
};

export function getDueStatus(card: CreditCardDue, referenceDate: Date = new Date()): DueStatus {
  return getDueDateStatus(card.dueDate, referenceDate, DUE_SOON_WINDOW_DAYS);
}

export function totalStatementBalance(cards: CreditCardDue[]): number {
  return cards.reduce((sum, card) => sum + card.statementBalance, 0);
}

export function monthlyEquivalentIncome(source: IncomeSource): number {
  return source.amount * MONTHLY_MULTIPLIER[source.frequency];
}

export function totalMonthlyIncome(sources: IncomeSource[]): number {
  return sources.reduce((sum, source) => sum + monthlyEquivalentIncome(source), 0);
}
