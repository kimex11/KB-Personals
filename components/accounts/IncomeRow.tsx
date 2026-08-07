import type { IncomeSource } from '@/lib/accounts-types';
import { formatRelativeDate } from '@/lib/date-utils';

const FREQUENCY_LABEL: Record<IncomeSource['frequency'], string> = {
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
};

interface IncomeRowProps {
  source: IncomeSource;
  referenceDate?: Date;
}

export function IncomeRow({ source, referenceDate = new Date() }: IncomeRowProps) {
  return (
    <div
      data-testid="income-row"
      className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3"
    >
      <div className="flex-1">
        <p className="text-sm font-medium text-neutral-900">{source.name}</p>
        <p className="text-xs text-neutral-500">
          {FREQUENCY_LABEL[source.frequency]} · Next {formatRelativeDate(source.nextDate, referenceDate)}
        </p>
      </div>
      <span className="font-serif text-sm text-status-success">₱{source.amount.toFixed(2)}</span>
    </div>
  );
}
