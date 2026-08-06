import type { LucideIcon } from 'lucide-react';

interface PlaceholderScreenProps {
  icon: LucideIcon;
}

export function PlaceholderScreen({ icon: Icon }: PlaceholderScreenProps) {
  return (
    <div
      data-testid="placeholder-screen"
      className="flex flex-col items-center justify-center gap-3 px-4 pb-24 pt-24 text-center"
    >
      <Icon data-testid="placeholder-screen-icon" className="h-10 w-10 text-neutral-300" strokeWidth={1.5} />
      <p className="text-sm text-neutral-400">Coming soon</p>
    </div>
  );
}
