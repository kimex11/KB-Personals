import type { IncomeSource } from '@/lib/accounts-types';
import { RowActionsMenu } from '@/components/shared/RowActionsMenu';
import { formatRelativeDate } from '@/lib/date-utils';

const FREQUENCY_LABEL: Record<IncomeSource['frequency'], string> = {
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
};

interface IncomeRowProps {
  source: IncomeSource;
  referenceDate?: Date;
  onEdit?: (source: IncomeSource) => void;
  onDelete?: (source: IncomeSource) => void;
}

export function IncomeRow({ source, referenceDate = new Date(), onEdit, onDelete }: IncomeRowProps) {
  return (
    <div
      data-testid="income-row"
      className="flex items-center justify-between gap-3 rounded-2xl border border-l-4 border-neutral-200 border-l-status-success bg-status-success/5 px-4 py-3"
    >
      <div className="flex-1">
        <p className="text-sm font-medium text-neutral-900">{source.name}</p>
        <p className="text-xs text-neutral-500">
          {FREQUENCY_LABEL[source.frequency]} · Next {formatRelativeDate(source.nextDate, referenceDate)}
        </p>
      </div>
      <span className="font-serif text-sm text-status-success">₱{source.amount.toFixed(2)}</span>
      <RowActionsMenu
        label={source.name}
        onEdit={onEdit ? () => onEdit(source) : undefined}
        onDelete={onDelete ? () => onDelete(source) : undefined}
      />
    </div>
  );
}
