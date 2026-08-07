export type CategoryIconKey =
  | 'building-2'
  | 'shopping-cart'
  | 'car'
  | 'film'
  | 'zap'
  | 'shopping-bag'
  | 'home'
  | 'heart'
  | 'plane'
  | 'coffee'
  | 'gift'
  | 'book'
  | 'dumbbell'
  | 'smartphone'
  | 'wifi'
  | 'credit-card'
  | 'piggy-bank'
  | 'wallet'
  | 'utensils'
  | 'bus'
  | 'fuel'
  | 'graduation-cap'
  | 'stethoscope'
  | 'paw-print';

export interface Category {
  id: string;
  name: string;
  icon: CategoryIconKey;
  colorSlot: number; // 1-12
  sortOrder: number;
  archived: boolean;
  createdAt: string;
}
