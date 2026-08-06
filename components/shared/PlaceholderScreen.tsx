interface PlaceholderScreenProps {
  title: string;
}

export function PlaceholderScreen({ title }: PlaceholderScreenProps) {
  return (
    <div data-testid="placeholder-screen" className="flex flex-col items-center justify-center gap-2 px-4 pb-24 pt-24 text-center">
      <p className="font-serif text-lg text-neutral-900">{title}</p>
      <p className="text-sm text-neutral-400">Coming soon</p>
    </div>
  );
}
