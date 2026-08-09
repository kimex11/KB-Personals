'use client';

import { MoreVertical, Pencil, SkipForward, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

interface RowActionsMenuProps {
  label: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onSkip?: () => void;
}

export function RowActionsMenu({ label, onEdit, onDelete, onSkip }: RowActionsMenuProps) {
  if (!onEdit && !onDelete && !onSkip) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="min-h-11 min-w-11" aria-label={`Actions for ${label}`}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        }
      />
      <DropdownMenuContent>
        {onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            Edit
          </DropdownMenuItem>
        )}
        {onSkip && (
          <DropdownMenuItem onClick={onSkip}>
            <SkipForward className="h-4 w-4" />
            Skip this cycle
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
