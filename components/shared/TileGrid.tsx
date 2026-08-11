import type { ReactNode } from 'react';

interface TileGridProps {
  children: ReactNode;
  testId?: string;
}

export function TileGrid({ children, testId = 'tile-grid' }: TileGridProps) {
  return (
    <div data-testid={testId} className="grid grid-cols-2 gap-3">
      {children}
    </div>
  );
}
