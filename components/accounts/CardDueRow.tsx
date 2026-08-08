import type { CreditCardDue, DueStatus } from '@/lib/accounts-types';
import { getDueStatus } from '@/lib/accounts-selectors';
import { CardDueStatusBadge } from './CardDueStatusBadge';
import { RowActionsMenu } from '@/components/shared/RowActionsMenu';
import { formatRelativeDate } from '@/lib/date-utils';

const STATUS_ACCENT_BORDER: Record<DueStatus, string> = {
  overdue: 'border-l-status-critical',
  'due-soon': 'border-l-status-warning',
  upcoming: 'border-l-neutral-200',
};

const STATUS_CARD_BG: Record<DueStatus, string> = {
  overdue: 'bg-status-critical/5',
  'due-soon': 'bg-status-warning/5',
  upcoming: 'bg-white',
};

const STATUS_BALANCE_COLOR: Record<DueStatus, string> = {
  overdue: 'text-status-critical',
  'due-soon': 'text-status-warning',
  upcoming: 'text-neutral-900',
};

interface CardDueRowProps {
  card: CreditCardDue;
  referenceDate?: Date;
  onEdit?: (card: CreditCardDue) => void;
  onDelete?: (card: CreditCardDue) => void;
}

export function CardDueRow({ card, referenceDate = new Date(), onEdit, onDelete }: CardDueRowProps) {
  const status = getDueStatus(card, referenceDate);

  return (
    <div
      data-testid="card-due-row"
      className={`flex items-center justify-between gap-3 rounded-2xl border border-l-4 border-neutral-200 px-4 py-3 ${STATUS_CARD_BG[status]} ${STATUS_ACCENT_BORDER[status]}`}
    >
      <div className="flex-1">
        <p className="text-sm font-medium text-neutral-900">{card.cardName}</p>
        <p className="text-xs text-neutral-500">
          ••{card.last4} · {formatRelativeDate(card.dueDate, referenceDate)}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span data-testid="card-due-balance" className={`font-serif text-sm ${STATUS_BALANCE_COLOR[status]}`}>
          ₱{card.statementBalance.toFixed(2)}
        </span>
        <span className="text-[10px] text-neutral-400">Min ₱{card.minimumPayment.toFixed(2)}</span>
        <CardDueStatusBadge status={status} />
      </div>
      <RowActionsMenu
        label={card.cardName}
        onEdit={onEdit ? () => onEdit(card) : undefined}
        onDelete={onDelete ? () => onDelete(card) : undefined}
      />
    </div>
  );
}
