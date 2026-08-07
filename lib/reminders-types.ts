export type Priority = 'high' | 'medium' | 'low';

export interface Reminder {
  id: string;
  title: string;
  category: string;
  dueDate: string; // ISO 'yyyy-MM-dd'
  priority: Priority;
  completed: boolean;
}
