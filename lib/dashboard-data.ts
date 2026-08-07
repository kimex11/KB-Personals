import { addDays } from 'date-fns';
import type { Transaction, SavingsGoal } from './dashboard-types';
import { toISODateString } from './date-utils';

interface MockTransactionSeed {
  dayOffset: number;
  title: string;
  category: string;
  amount: number;
}

const TRANSACTION_SEEDS: MockTransactionSeed[] = [
  { dayOffset: -1, title: 'Grab Ride', category: 'Transport', amount: 8.5 },
  { dayOffset: -2, title: 'Grocery Run', category: 'Groceries', amount: 42.3 },
  { dayOffset: -3, title: 'Netflix', category: 'Entertainment', amount: 15.99 },
  { dayOffset: -5, title: 'Coffee Shop', category: 'Shopping', amount: 6.75 },
  { dayOffset: -6, title: 'Electric Bill Payment', category: 'Utilities', amount: 84.5 },
];

export function generateMockTransactions(baseDate: Date = new Date()): Transaction[] {
  return TRANSACTION_SEEDS.map(({ dayOffset, ...rest }, index) => ({
    id: `txn-${index}`,
    date: toISODateString(addDays(baseDate, dayOffset)),
    ...rest,
  })).sort((a, b) => (a.date < b.date ? 1 : -1));
}

export const mockTransactions: Transaction[] = generateMockTransactions();

export const mockGoal: SavingsGoal = {
  id: 'emergency-fund',
  title: 'Emergency Fund',
  saved: 3200,
  target: 6000,
};
