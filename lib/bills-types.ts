export type RecurrenceInterval = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | null;

export interface Bill {
  id: string;
  title: string;
  category: string;
  amount: number;
  dueDate: string; // ISO 'yyyy-MM-dd'
  recurrence: RecurrenceInterval;
  paid: boolean;
}

export type BillStatus = 'paid' | 'overdue' | 'due-soon' | 'upcoming';
