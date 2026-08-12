export type RecurrenceInterval = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | null;

export interface Bill {
  id: string;
  title: string;
  category: string;
  categoryColorSlot?: number;
  amount: number;
  dueDate: string; // ISO 'yyyy-MM-dd'
  recurrence: RecurrenceInterval;
  paid: boolean;
  seriesId: string | null;
  cycleNumber: number | null;
  skipped: boolean;
}

export type BillStatus = 'paid' | 'overdue' | 'due-soon' | 'upcoming';
