import Link from 'next/link';
import { CARD_TINT_COLOR_CLASS } from '@/lib/category-colors';
import { formatCurrency } from '@/lib/format-currency';
import { monthsPaid, remainingBalance } from '@/lib/payment-plan-selectors';
import type { PaymentPlan } from '@/lib/payment-plans-repository';
import type { PaymentPlanPayment } from '@/lib/payment-plan-payments-repository';

interface PaymentPlanTileProps {
  plan: PaymentPlan;
  payments: PaymentPlanPayment[];
}

export function PaymentPlanTile({ plan, payments }: PaymentPlanTileProps) {
  return (
    <Link
      href={`/budget/plans/${plan.id}`}
      data-testid="payment-plan-row"
      className={`flex flex-col gap-2 rounded-2xl p-4 ${CARD_TINT_COLOR_CLASS[plan.categoryColorSlot]}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-900">{plan.name}</p>
          <p className="text-xs text-neutral-500">
            {plan.category} · {monthsPaid(payments)} of {plan.installmentCount} paid
          </p>
        </div>
        <span className="font-serif text-sm text-neutral-900">₱{formatCurrency(remainingBalance(plan, payments))}</span>
      </div>
    </Link>
  );
}
