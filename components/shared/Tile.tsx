import Link from 'next/link';
import type { ReactNode } from 'react';

interface TileProps {
  tintClassName: string;
  href?: string;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
  testId?: string;
  children: ReactNode;
}

export function Tile({ tintClassName, href, onClick, ariaLabel, className = '', testId = 'tile', children }: TileProps) {
  const sharedClassName = `rounded-2xl p-4 text-left transition-colors ${tintClassName} ${className}`;

  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} data-testid={testId} className={`block ${sharedClassName}`}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} data-testid={testId} className={`w-full ${sharedClassName}`}>
      {children}
    </button>
  );
}
