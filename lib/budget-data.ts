import { Building2, ShoppingCart, Car, Film, Zap, ShoppingBag } from 'lucide-react';
import type { BudgetCategory } from './budget-types';

export const budgetCategories: BudgetCategory[] = [
  { id: 'housing', name: 'Housing', icon: Building2, colorSlot: 1, limit: 1450, spent: 1450 },
  { id: 'groceries', name: 'Groceries', icon: ShoppingCart, colorSlot: 2, limit: 500, spent: 468 },
  { id: 'transport', name: 'Transport', icon: Car, colorSlot: 3, limit: 200, spent: 145 },
  { id: 'entertainment', name: 'Entertainment', icon: Film, colorSlot: 4, limit: 120, spent: 138 },
  { id: 'utilities', name: 'Utilities', icon: Zap, colorSlot: 5, limit: 220, spent: 190 },
  { id: 'shopping', name: 'Shopping', icon: ShoppingBag, colorSlot: 6, limit: 300, spent: 95 },
];
