'use client';

import { usePathname } from 'next/navigation';
import { TAB_ITEMS } from './tab-config';
import { LogoutButton } from '@/components/auth/LogoutButton';

export function Header() {
  const pathname = usePathname();
  const title = TAB_ITEMS.find((tab) => tab.href === pathname)?.label ?? 'Home';

  return (
    <header data-testid="app-header" className="flex items-center gap-3 px-4 pb-2 pt-6">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-serif text-sm text-gold">
        KB
      </span>
      <h1 className="font-serif text-xl text-neutral-900">{title}</h1>
      <div className="ml-auto">
        <LogoutButton />
      </div>
    </header>
  );
}
