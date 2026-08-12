'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { TAB_ITEMS } from './tab-config';

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      data-testid="tab-bar"
      className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md items-stretch border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] pt-2"
    >
      {TAB_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            data-testid={`tab-${label.toLowerCase()}`}
            aria-current={isActive ? 'page' : undefined}
            className={`relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-0.5 pb-2 pt-1 text-[10px] transition-colors ${
              isActive ? 'bg-gold/10' : ''
            }`}
          >
            <Icon className={isActive ? 'h-5 w-5 shrink-0 text-gold' : 'h-5 w-5 shrink-0 text-neutral-400'} strokeWidth={isActive ? 2.5 : 2} />
            <span className={`w-full truncate text-center ${isActive ? 'text-gold' : 'text-neutral-400'}`}>{label}</span>
            {isActive && (
              <motion.span
                layoutId="tab-indicator"
                data-testid="tab-indicator"
                className="absolute -top-2 h-0.5 w-6 rounded-full bg-gold"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
