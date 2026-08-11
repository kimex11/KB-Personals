import type { LucideIcon } from 'lucide-react';
import { Receipt, Bell, Wallet, CreditCard, Camera } from 'lucide-react';
import { Tile } from '@/components/shared/Tile';
import { TileGrid } from '@/components/shared/TileGrid';

export interface LauncherTileData {
  id: 'bills' | 'reminders' | 'budget' | 'accounts' | 'receipts';
  label: string;
  stat: string;
  href: string;
}

const TILE_CONFIG: Record<LauncherTileData['id'], { icon: LucideIcon; tintClassName: string; iconClassName: string }> = {
  bills: { icon: Receipt, tintClassName: 'bg-status-critical/10', iconClassName: 'text-status-critical' },
  reminders: { icon: Bell, tintClassName: 'bg-calendar-reminder/10', iconClassName: 'text-calendar-reminder' },
  budget: { icon: Wallet, tintClassName: 'bg-gold/10', iconClassName: 'text-gold' },
  accounts: { icon: CreditCard, tintClassName: 'bg-status-success/10', iconClassName: 'text-status-success' },
  receipts: { icon: Camera, tintClassName: 'bg-calendar-task/10', iconClassName: 'text-calendar-task' },
};

interface LauncherTilesProps {
  tiles: LauncherTileData[];
}

export function LauncherTiles({ tiles }: LauncherTilesProps) {
  return (
    <TileGrid testId="launcher-tiles">
      {tiles.map((tile) => {
        const config = TILE_CONFIG[tile.id];
        const Icon = config.icon;
        return (
          <Tile
            key={tile.id}
            href={tile.href}
            tintClassName={config.tintClassName}
            ariaLabel={`${tile.label}, ${tile.stat}`}
            testId={`launcher-tile-${tile.id}`}
          >
            <Icon className={`h-6 w-6 ${config.iconClassName}`} />
            <p className="mt-2 text-sm font-medium text-neutral-900">{tile.label}</p>
            <p className="text-xs text-neutral-500">{tile.stat}</p>
          </Tile>
        );
      })}
    </TileGrid>
  );
}
