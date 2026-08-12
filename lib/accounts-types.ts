export interface CreditCardDue {
  id: string;
  cardName: string;
  last4: string;
  statementBalance: number;
  minimumPayment: number;
  dueDate: string; // ISO 'yyyy-MM-dd'
  balanceAnchorAt: string; // ISO timestamp — payments before this point applied to a superseded statement balance
  imageUrl: string | null;
  imageStoragePath: string | null;
}

export interface IncomeSource {
  id: string;
  name: string;
  amount: number;
  date: string; // ISO 'yyyy-MM-dd' — the exact date this income was received or is expected
}

export type DueStatus = 'overdue' | 'due-soon' | 'upcoming';
