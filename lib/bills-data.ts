import { addDays } from 'date-fns';
import type { Bill } from './bills-types';
import { toISODateString } from './date-utils';

interface MockBillSeed {
  dayOffset: number;
  title: string;
  category: string;
  amount: number;
  recurrence: Bill['recurrence'];
  paid: boolean;
}

const BILL_SEEDS: MockBillSeed[] = [
  { dayOffset: -20, title: 'Rent', category: 'Housing', amount: 1450, recurrence: 'monthly', paid: true },
  { dayOffset: -10, title: 'Internet Bill', category: 'Utilities', amount: 59.99, recurrence: 'monthly', paid: true },
  { dayOffset: -3, title: 'Credit Card Payment', category: 'Shopping', amount: 320.15, recurrence: null, paid: false },
  { dayOffset: 0, title: 'Electricity Bill', category: 'Utilities', amount: 84.5, recurrence: 'monthly', paid: false },
  { dayOffset: 1, title: 'Netflix', category: 'Entertainment', amount: 15.99, recurrence: 'monthly', paid: false },
  { dayOffset: 2, title: 'Car Insurance', category: 'Transport', amount: 145, recurrence: 'quarterly', paid: false },
  { dayOffset: 6, title: 'Phone Plan', category: 'Utilities', amount: 45, recurrence: 'monthly', paid: false },
  { dayOffset: 15, title: 'Gym Membership', category: 'Entertainment', amount: 29.99, recurrence: 'monthly', paid: false },
  { dayOffset: 25, title: 'Annual Domain Renewal', category: 'Shopping', amount: 18, recurrence: 'yearly', paid: false },
];

export function generateMockBills(baseDate: Date = new Date()): Bill[] {
  return BILL_SEEDS.map(({ dayOffset, ...rest }, index) => ({
    id: `bill-${index}`,
    dueDate: toISODateString(addDays(baseDate, dayOffset)),
    ...rest,
  }));
}

export const mockBills: Bill[] = generateMockBills();
