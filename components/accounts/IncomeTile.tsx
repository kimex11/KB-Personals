import type { IncomeSource } from '@/lib/accounts-types';
import { RowActionsMenu } from '@/components/shared/RowActionsMenu';
import { formatRelativeDate } from '@/lib/date-utils';

const FREQUENCY_LABEL: Record<IncomeSource['frequency'], string> = {
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
};

interface IncomeTileProps {
  source: IncomeSource;
  referenceDate?: Date;
  onEdit?: (source: IncomeSource) => void;
  onDelete?: (source: IncomeSource) => void;
}

export function IncomeTile({ source, referenceDate = new Date(), onEdit, onDelete }: IncomeTileProps) {
  return (
    <div data-testid="income-row" className="flex flex-col gap-2 rounded-2xl bg-status-success/10 p-4">
      <div className="flex items-center justify-end">
        <RowActionsMenu
          label={source.name}
          onEdit={onEdit ? () => onEdit(source) : undefined}
          onDelete={onDelete ? () => onDelete(source) : undefined}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-neutral-900">{source.name}</p>
        <p className="text-xs text-neutral-500">
          {FREQUENCY_LABEL[source.frequency]} · Next {formatRelativeDate(source.nextDate, referenceDate)}
        </p>
      </div>
      <span className="font-serif text-sm text-status-success">₱{source.amount.toFixed(2)}</span>
    </div>
  );
}
