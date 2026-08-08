import type { Bill, BillStatus } from './bills-types';
import { getDueDateStatus, toISODateString } from './date-utils';
import { startOfMonth, endOfMonth, differenceInCalendarDays, parseISO } from 'date-fns';

const DUE_SOON_WINDOW_DAYS = 3;
const DUPLICATE_DUE_DATE_WINDOW_DAYS = 3;

export function getBillStatus(bill: Bill, referenceDate: Date = new Date()): BillStatus {
  if (bill.paid) return 'paid';
  return getDueDateStatus(bill.dueDate, referenceDate, DUE_SOON_WINDOW_DAYS);
}

export function groupBillsByStatus(bills: Bill[], referenceDate: Date = new Date()): Record<BillStatus, Bill[]> {
  const groups: Record<BillStatus, Bill[]> = { overdue: [], 'due-soon': [], upcoming: [], paid: [] };
  for (const bill of bills) {
    groups[getBillStatus(bill, referenceDate)].push(bill);
  }
  return groups;
}

export function filterBills(
  bills: Bill[],
  query: string,
  statusFilter: BillStatus | 'all',
  referenceDate: Date = new Date()
): Bill[] {
  const q = query.trim().toLowerCase();
  return bills.filter((bill) => {
    const matchesQuery = q === '' || bill.title.toLowerCase().includes(q) || bill.category.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || getBillStatus(bill, referenceDate) === statusFilter;
    return matchesQuery && matchesStatus;
  });
}

export function sortBills(bills: Bill[], sortBy: 'dueDate' | 'amount'): Bill[] {
  const copy = [...bills];
  if (sortBy === 'amount') {
    copy.sort((a, b) => b.amount - a.amount);
  } else {
    copy.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  }
  return copy;
}

export function monthlyBillTotal(bills: Bill[], referenceDate: Date = new Date()): number {
  const start = toISODateString(startOfMonth(referenceDate));
  const end = toISODateString(endOfMonth(referenceDate));
  return bills
    .filter((bill) => bill.dueDate >= start && bill.dueDate <= end)
    .reduce((sum, bill) => sum + bill.amount, 0);
}

// Flags likely-duplicate bills: same title (case/whitespace-insensitive) and
// amount, due within a few days of each other. Only compares unpaid bills —
// a paid bill isn't an actionable duplicate warning.
export function findDuplicateBillIds(bills: Bill[]): Set<string> {
  const unpaid = bills.filter((bill) => !bill.paid);
  const duplicateIds = new Set<string>();

  for (let i = 0; i < unpaid.length; i++) {
    for (let j = i + 1; j < unpaid.length; j++) {
      const a = unpaid[i];
      const b = unpaid[j];
      const sameTitle = a.title.trim().toLowerCase() === b.title.trim().toLowerCase();
      const sameAmount = a.amount === b.amount;
      const daysApart = Math.abs(differenceInCalendarDays(parseISO(a.dueDate), parseISO(b.dueDate)));

      if (sameTitle && sameAmount && daysApart <= DUPLICATE_DUE_DATE_WINDOW_DAYS) {
        duplicateIds.add(a.id);
        duplicateIds.add(b.id);
      }
    }
  }

  return duplicateIds;
}
