export type EventType = 'bill' | 'reminder' | 'task' | 'expense' | 'payment';

export interface CalendarEvent {
  id: string;
  type: EventType;
  title: string;
  date: string; // ISO 'yyyy-MM-dd'
  time?: string;
  amount?: number;
}
