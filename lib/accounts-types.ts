export interface CreditCardDue {
  id: string;
  cardName: string;
  last4: string;
  statementBalance: number;
  minimumPayment: number;
  dueDate: string; // ISO 'yyyy-MM-dd'
}

export type IncomeFrequency = 'weekly' | 'biweekly' | 'monthly';

export interface IncomeSource {
  id: string;
  name: string;
  amount: number;
  frequency: IncomeFrequency;
  nextDate: string; // ISO 'yyyy-MM-dd'
}

export type DueStatus = 'overdue' | 'due-soon' | 'upcoming';
