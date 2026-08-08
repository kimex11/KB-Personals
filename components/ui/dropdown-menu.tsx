'use client';

import * as React from 'react';
import { Menu } from '@base-ui/react/menu';
import { cn } from '@/lib/utils';

function DropdownMenu({ ...props }: Menu.Root.Props) {
  return <Menu.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger({ ...props }: Menu.Trigger.Props) {
  return <Menu.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({ className, sideOffset = 6, ...props }: Menu.Popup.Props & { sideOffset?: number }) {
  return (
    <Menu.Portal>
      <Menu.Positioner sideOffset={sideOffset} align="end">
        <Menu.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            'z-50 min-w-[9rem] overflow-hidden rounded-xl border border-neutral-200 bg-white p-1 shadow-lg outline-none transition data-ending-style:opacity-0 data-ending-style:scale-95 data-starting-style:opacity-0 data-starting-style:scale-95',
            className
          )}
          {...props}
        />
      </Menu.Positioner>
    </Menu.Portal>
  );
}

function DropdownMenuItem({
  className,
  variant = 'default',
  ...props
}: Menu.Item.Props & { variant?: 'default' | 'destructive' }) {
  return (
    <Menu.Item
      data-slot="dropdown-menu-item"
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none data-highlighted:bg-neutral-100',
        variant === 'destructive' ? 'text-status-critical' : 'text-neutral-700',
        className
      )}
      {...props}
    />
  );
}

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem };
