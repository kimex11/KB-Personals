import type { CreditCardDue, DueStatus } from '@/lib/accounts-types';
import { getDueStatus } from '@/lib/accounts-selectors';
import { CardDueStatusBadge } from './CardDueStatusBadge';
import { RowActionsMenu } from '@/components/shared/RowActionsMenu';
import { formatRelativeDate } from '@/lib/date-utils';

const STATUS_TINT: Record<DueStatus, string> = {
  overdue: 'bg-status-critical/10',
  'due-soon': 'bg-status-warning/10',
  upcoming: 'bg-neutral-100',
};

const STATUS_BALANCE_COLOR: Record<DueStatus, string> = {
  overdue: 'text-status-critical',
  'due-soon': 'text-status-warning',
  upcoming: 'text-neutral-900',
};

interface CardDueTileProps {
  card: CreditCardDue;
  referenceDate?: Date;
  onEdit?: (card: CreditCardDue) => void;
  onDelete?: (card: CreditCardDue) => void;
}

export function CardDueTile({ card, referenceDate = new Date(), onEdit, onDelete }: CardDueTileProps) {
  const status = getDueStatus(card, referenceDate);

  return (
    <div data-testid="card-due-row" className={`flex flex-col gap-2 rounded-2xl p-4 ${STATUS_TINT[status]}`}>
      <div className="flex items-center justify-end">
        <RowActionsMenu
          label={card.cardName}
          onEdit={onEdit ? () => onEdit(card) : undefined}
          onDelete={onDelete ? () => onDelete(card) : undefined}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-neutral-900">{card.cardName}</p>
        <p className="text-xs text-neutral-500">
          ••{card.last4} · {formatRelativeDate(card.dueDate, referenceDate)}
        </p>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span data-testid="card-due-balance" className={`font-serif text-sm ${STATUS_BALANCE_COLOR[status]}`}>
            ₱{card.statementBalance.toFixed(2)}
          </span>
          <span className="text-[10px] text-neutral-400">Min ₱{card.minimumPayment.toFixed(2)}</span>
        </div>
        <CardDueStatusBadge status={status} />
      </div>
    </div>
  );
}
