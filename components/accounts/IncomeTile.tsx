import { format, parseISO } from 'date-fns';
import type { IncomeSource } from '@/lib/accounts-types';
import { RowActionsMenu } from '@/components/shared/RowActionsMenu';
import { formatCurrency } from '@/lib/format-currency';
import { colorSlotForId, BORDER_COLOR_CLASS } from '@/lib/category-colors';

interface IncomeTileProps {
  source: IncomeSource;
  referenceDate?: Date;
  onEdit?: (source: IncomeSource) => void;
  onDelete?: (source: IncomeSource) => void;
}

export function IncomeTile({ source, onEdit, onDelete }: IncomeTileProps) {
  const accentColorSlot = colorSlotForId(source.id);

  return (
    <div
      data-testid="income-row"
      className={`flex flex-col gap-2 rounded-2xl border-l-4 bg-status-success/10 p-4 ${BORDER_COLOR_CLASS[accentColorSlot]}`}
    >
      <div className="flex items-center justify-end">
        <RowActionsMenu
          label={source.name}
          onEdit={onEdit ? () => onEdit(source) : undefined}
          onDelete={onDelete ? () => onDelete(source) : undefined}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-neutral-900">{source.name}</p>
        <p className="text-xs text-neutral-500">{format(parseISO(source.date), 'MMM d, yyyy')}</p>
      </div>
      <span className="font-serif text-sm text-status-success">₱{formatCurrency(source.amount)}</span>
    </div>
  );
}
