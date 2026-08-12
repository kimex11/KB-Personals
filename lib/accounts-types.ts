export interface CreditCardDue {
  id: string;
  cardName: string;
  last4: string;
  statementBalance: number;
  minimumPayment: number;
  dueDate: string; // ISO 'yyyy-MM-dd'
}

export interface IncomeSource {
  id: string;
  name: string;
  amount: number;
  date: string; // ISO 'yyyy-MM-dd' — the exact date this income was received or is expected
}

export type DueStatus = 'overdue' | 'due-soon' | 'upcoming';
