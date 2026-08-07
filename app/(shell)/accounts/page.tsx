'use client';

import { mockCreditCardDues, mockIncomeSources } from '@/lib/accounts-data';
import { totalStatementBalance, totalMonthlyIncome } from '@/lib/accounts-selectors';
import { AccountsSummary } from '@/components/accounts/AccountsSummary';
import { CardDueRow } from '@/components/accounts/CardDueRow';
import { IncomeRow } from '@/components/accounts/IncomeRow';
import { useIsMounted } from '@/lib/use-is-mounted';

export default function AccountsPage() {
  const isMounted = useIsMounted();
  const totalDue = totalStatementBalance(mockCreditCardDues);
  const monthlyIncome = totalMonthlyIncome(mockIncomeSources);

  return (
    <div data-testid="accounts-page" className="flex flex-col gap-6 px-4 pb-24 pt-4">
      {isMounted && (
        <>
          <AccountsSummary totalDue={totalDue} totalMonthlyIncome={monthlyIncome} />
          <div className="flex flex-col gap-3">
            <h2 className="font-serif text-lg text-neutral-900">Credit Card Dues</h2>
            <div className="flex flex-col gap-2">
              {mockCreditCardDues.map((card) => (
                <CardDueRow key={card.id} card={card} referenceDate={new Date()} />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="font-serif text-lg text-neutral-900">Income</h2>
            <div className="flex flex-col gap-2">
              {mockIncomeSources.map((source) => (
                <IncomeRow key={source.id} source={source} referenceDate={new Date()} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
