import { format, parseISO } from 'date-fns';
import type { Expense } from '@/lib/expenses-repository';
import { CARD_TINT_COLOR_CLASS } from '@/lib/category-colors';
import { RowActionsMenu } from '@/components/shared/RowActionsMenu';
import { formatCurrency } from '@/lib/format-currency';

interface ExpenseTileProps {
  expense: Expense;
  onEdit?: (expense: Expense) => void;
  onDelete?: (expense: Expense) => void;
}

export function ExpenseTile({ expense, onEdit, onDelete }: ExpenseTileProps) {
  const label = expense.description ?? expense.category;

  return (
    <div data-testid="expense-row" className={`flex flex-col gap-2 rounded-2xl p-4 ${CARD_TINT_COLOR_CLASS[expense.categoryColorSlot]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-900">{label}</p>
          <p className="text-xs text-neutral-500">
            {expense.category} · {format(parseISO(expense.date), 'MMM d, yyyy')}
            {expense.paymentMethod ? ` · ${expense.paymentMethod}` : ''}
          </p>
        </div>
        <RowActionsMenu
          label={label}
          onEdit={onEdit ? () => onEdit(expense) : undefined}
          onDelete={onDelete ? () => onDelete(expense) : undefined}
        />
      </div>
      <span className="font-serif text-sm text-status-critical">-₱{formatCurrency(expense.amount)}</span>
    </div>
  );
}
