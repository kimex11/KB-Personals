import type { LucideIcon } from 'lucide-react';

export interface BudgetCategory {
  id: string;
  name: string;
  icon: LucideIcon;
  colorSlot: 1 | 2 | 3 | 4 | 5 | 6;
  limit: number;
  spent: number;
}
