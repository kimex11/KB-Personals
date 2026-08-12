import Link from 'next/link';
import type { CreditCardDue, DueStatus } from '@/lib/accounts-types';
import { getDueStatus } from '@/lib/accounts-selectors';
import { remainingCardBalance } from '@/lib/credit-card-payment-selectors';
import { CardDueStatusBadge } from './CardDueStatusBadge';
import { RowActionsMenu } from '@/components/shared/RowActionsMenu';
import { formatRelativeDate } from '@/lib/date-utils';
import { formatCurrency } from '@/lib/format-currency';
import type { CreditCardPayment } from '@/lib/credit-card-payments-repository';

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
  payments?: CreditCardPayment[];
  referenceDate?: Date;
  onEdit?: (card: CreditCardDue) => void;
  onDelete?: (card: CreditCardDue) => void;
}

export function CardDueTile({ card, payments = [], referenceDate = new Date(), onEdit, onDelete }: CardDueTileProps) {
  const status = getDueStatus(card, referenceDate);
  const balance = remainingCardBalance(card, payments);

  return (
    <div data-testid="card-due-row" className={`flex flex-col gap-2 rounded-2xl p-4 ${STATUS_TINT[status]}`}>
      <div className="flex items-center justify-end">
        <RowActionsMenu
          label={card.cardName}
          onEdit={onEdit ? () => onEdit(card) : undefined}
          onDelete={onDelete ? () => onDelete(card) : undefined}
        />
      </div>
      <div className="flex items-center gap-3">
        {card.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.imageUrl} alt={`${card.cardName} artwork`} className="h-10 w-14 shrink-0 rounded-lg object-cover" />
        )}
        <div>
          <p className="text-sm font-medium text-neutral-900">{card.cardName}</p>
          <p className="text-xs text-neutral-500">
            ••{card.last4} · {formatRelativeDate(card.dueDate, referenceDate)}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span data-testid="card-due-balance" className={`font-serif text-sm ${STATUS_BALANCE_COLOR[status]}`}>
            ₱{formatCurrency(balance)}
          </span>
          <span className="text-[10px] text-neutral-400">Min ₱{formatCurrency(card.minimumPayment)}</span>
        </div>
        <CardDueStatusBadge status={status} />
      </div>
      <Link
        href={`/accounts/cards/${card.id}`}
        data-testid="card-view-history-link"
        className="flex min-h-11 items-center justify-center rounded-full border border-neutral-200 text-xs font-medium text-neutral-600"
      >
        View history
      </Link>
    </div>
  );
}
