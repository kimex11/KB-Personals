import { Home, PieChart, Receipt, Bell, Camera } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface TabItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const TAB_ITEMS: TabItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/budget', label: 'Budget', icon: PieChart },
  { href: '/bills', label: 'Bills', icon: Receipt },
  { href: '/reminders', label: 'Reminders', icon: Bell },
  { href: '/receipts', label: 'Receipts', icon: Camera },
];
