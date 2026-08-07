import type { LucideIcon } from 'lucide-react';

export interface BudgetCategory {
  id: string;
  name: string;
  icon: LucideIcon;
  colorSlot: number;
  limit: number;
  spent: number;
}
