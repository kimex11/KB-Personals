import Link from 'next/link';
import { Receipt, Bell, Camera } from 'lucide-react';

const ACTIONS = [
  { id: 'bill', label: 'Add Bill', icon: Receipt, href: '/bills' },
  { id: 'reminder', label: 'Add Reminder', icon: Bell, href: '/reminders' },
  { id: 'receipt', label: 'Add Receipt', icon: Camera, href: '/receipts' },
] as const;

export function QuickActionsRow() {
  return (
    <div data-testid="quick-actions-row" className="grid grid-cols-3 gap-2">
      {ACTIONS.map(({ id, label, icon: Icon, href }) => (
        <Link
          key={id}
          href={href}
          data-testid={`quick-action-${id}`}
          aria-label={label}
          className="flex h-auto w-auto flex-col items-center gap-1 rounded-2xl border border-neutral-200 bg-white px-2 py-3 text-neutral-700"
        >
          <Icon className="h-5 w-5" />
          <span className="text-[10px]">{label}</span>
        </Link>
      ))}
    </div>
  );
}
