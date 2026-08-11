import { format, parseISO } from 'date-fns';

interface CardPaymentSummaryProps {
  remainingBalance: number;
  totalPaid: number;
  paymentsMade: number;
  lastPaymentDate: string | null;
  nextDueDate: string;
}

export function CardPaymentSummary({ remainingBalance, totalPaid, paymentsMade, lastPaymentDate, nextDueDate }: CardPaymentSummaryProps) {
  return (
    <div data-testid="card-payment-summary" className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500">Remaining Balance</span>
        <span data-testid="summary-remaining-balance" className="font-serif text-sm text-neutral-900">
          ₱{remainingBalance.toFixed(2)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500">Total Paid</span>
        <span data-testid="summary-total-paid" className="font-serif text-sm text-status-success">
          ₱{totalPaid.toFixed(2)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500">Payments Made</span>
        <span data-testid="summary-payments-made" className="font-serif text-sm text-neutral-900">
          {paymentsMade}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500">Last Payment</span>
        <span data-testid="summary-last-payment" className="text-xs text-neutral-700">
          {lastPaymentDate ? format(parseISO(lastPaymentDate), 'MMM d, yyyy') : 'No payments yet'}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500">Next Due Date</span>
        <span data-testid="summary-next-due-date" className="text-xs text-neutral-700">
          {format(parseISO(nextDueDate), 'MMM d, yyyy')}
        </span>
      </div>
    </div>
  );
}
