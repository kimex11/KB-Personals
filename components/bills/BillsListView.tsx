'use client';

import { useMemo, useState } from 'react';
import type { Bill, BillStatus } from '@/lib/bills-types';
import { filterBills, sortBills, groupBillsByStatus, monthlyBillTotal, findDuplicateBillIds } from '@/lib/bills-selectors';
import { BillsSummary } from './BillsSummary';
import { BillsFilterBar } from './BillsFilterBar';
import { BillRow } from './BillRow';
import { EmptyState } from '@/components/shared/EmptyState';

const SECTION_ORDER: { status: BillStatus; label: string }[] = [
  { status: 'overdue', label: 'Overdue' },
  { status: 'due-soon', label: 'Due Soon' },
  { status: 'upcoming', label: 'Upcoming' },
  { status: 'paid', label: 'Paid' },
];

const SECTION_DOT_COLOR: Record<BillStatus, string> = {
  overdue: 'bg-status-critical',
  'due-soon': 'bg-status-warning',
  upcoming: 'bg-neutral-300',
  paid: 'bg-status-success',
};

interface BillsListViewProps {
  bills: Bill[];
  onTogglePaid: (id: string) => void;
  referenceDate?: Date;
  onEdit?: (bill: Bill) => void;
  onDelete?: (bill: Bill) => void;
  onSkip?: (bill: Bill) => void;
}

export function BillsListView({ bills, onTogglePaid, referenceDate = new Date(), onEdit, onDelete, onSkip }: BillsListViewProps) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BillStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'dueDate' | 'amount'>('dueDate');

  const visibleBills = useMemo(
    () => sortBills(filterBills(bills, query, statusFilter, referenceDate), sortBy),
    [bills, query, statusFilter, sortBy, referenceDate]
  );

  const grouped = useMemo(() => groupBillsByStatus(visibleBills, referenceDate), [visibleBills, referenceDate]);
  const allGrouped = useMemo(() => groupBillsByStatus(bills, referenceDate), [bills, referenceDate]);
  const monthlyTotal = useMemo(() => monthlyBillTotal(bills, referenceDate), [bills, referenceDate]);
  const duplicateIds = useMemo(() => findDuplicateBillIds(bills), [bills]);

  return (
    <div data-testid="bills-list-view" className="flex flex-col gap-4">
      <BillsSummary
        monthlyTotal={monthlyTotal}
        overdueCount={allGrouped.overdue.length}
        dueSoonCount={allGrouped['due-soon'].length}
      />
      <BillsFilterBar
        query={query}
        onQueryChange={setQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        sortBy={sortBy}
        onSortByChange={setSortBy}
      />
      {visibleBills.length === 0 ? (
        <EmptyState message="No bills match your filters." />
      ) : (
        <div className="flex flex-col gap-4">
          {SECTION_ORDER.map(
            ({ status, label }) =>
              grouped[status].length > 0 && (
                <div key={status} className="flex flex-col gap-2">
                  <h2 className="flex items-center gap-2 font-serif text-sm text-neutral-500">
                    <span
                      data-testid={`bills-section-dot-${status}`}
                      className={`h-2 w-2 rounded-full ${SECTION_DOT_COLOR[status]}`}
                      aria-hidden="true"
                    />
                    {label}
                  </h2>
                  <div className="flex flex-col gap-2">
                    {grouped[status].map((bill) => (
                      <BillRow
                        key={bill.id}
                        bill={bill}
                        onTogglePaid={onTogglePaid}
                        referenceDate={referenceDate}
                        isDuplicate={duplicateIds.has(bill.id)}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onSkip={onSkip}
                      />
                    ))}
                  </div>
                </div>
              )
          )}
        </div>
      )}
    </div>
  );
}
