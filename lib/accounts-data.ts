import { addDays } from 'date-fns';
import type { CreditCardDue, IncomeSource } from './accounts-types';
import { toISODateString } from './date-utils';

interface MockCardSeed {
  dayOffset: number;
  cardName: string;
  last4: string;
  statementBalance: number;
  minimumPayment: number;
}

const CARD_SEEDS: MockCardSeed[] = [
  { dayOffset: -2, cardName: 'Visa Platinum', last4: '4821', statementBalance: 842.5, minimumPayment: 45 },
  { dayOffset: 4, cardName: 'Mastercard Gold', last4: '7734', statementBalance: 315.2, minimumPayment: 25 },
  { dayOffset: 18, cardName: 'Amex Everyday', last4: '2290', statementBalance: 128.75, minimumPayment: 15 },
];

export function generateMockCreditCardDues(baseDate: Date = new Date()): CreditCardDue[] {
  return CARD_SEEDS.map(({ dayOffset, ...rest }, index) => ({
    id: `card-${index}`,
    dueDate: toISODateString(addDays(baseDate, dayOffset)),
    ...rest,
  }));
}

export const mockCreditCardDues: CreditCardDue[] = generateMockCreditCardDues();

interface MockIncomeSeed {
  dayOffset: number;
  name: string;
  amount: number;
  frequency: IncomeSource['frequency'];
}

const INCOME_SEEDS: MockIncomeSeed[] = [
  { dayOffset: 5, name: 'Salary', amount: 3200, frequency: 'biweekly' },
  { dayOffset: 10, name: 'Freelance Design Work', amount: 450, frequency: 'monthly' },
];

export function generateMockIncomeSources(baseDate: Date = new Date()): IncomeSource[] {
  return INCOME_SEEDS.map(({ dayOffset, ...rest }, index) => ({
    id: `income-${index}`,
    nextDate: toISODateString(addDays(baseDate, dayOffset)),
    ...rest,
  }));
}

export const mockIncomeSources: IncomeSource[] = generateMockIncomeSources();
