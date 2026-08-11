import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LauncherTiles } from './LauncherTiles';
import type { LauncherTileData } from './LauncherTiles';

const tiles: LauncherTileData[] = [
  { id: 'bills', label: 'Bills', stat: '1 overdue', href: '/bills' },
  { id: 'reminders', label: 'Reminders', stat: '3 upcoming', href: '/reminders' },
  { id: 'budget', label: 'Budget', stat: '₱1918 of ₱1950', href: '/budget' },
  { id: 'accounts', label: 'Accounts', stat: '2 cards linked', href: '/accounts' },
  { id: 'receipts', label: 'Receipts', stat: 'Scan a new receipt', href: '/receipts' },
];

describe('LauncherTiles', () => {
  it('renders one tile per entry with its label, stat, and link', () => {
    render(<LauncherTiles tiles={tiles} />);
    for (const tile of tiles) {
      const el = screen.getByTestId(`launcher-tile-${tile.id}`);
      expect(el).toHaveTextContent(tile.label);
      expect(el).toHaveTextContent(tile.stat);
      expect(el).toHaveAttribute('href', tile.href);
    }
  });

  it('renders inside the shared tile grid', () => {
    render(<LauncherTiles tiles={tiles} />);
    expect(screen.getByTestId('launcher-tiles')).toBeInTheDocument();
  });
});
