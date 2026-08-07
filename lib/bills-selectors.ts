import type { Bill, BillStatus } from './bills-types';
import { toISODateString } from './date-utils';
import { addDays, startOfMonth, endOfMonth } from 'date-fns';

const DUE_SOON_WINDOW_DAYS = 3;

export function getBillStatus(bill: Bill, referenceDate: Date = new Date()): BillStatus {
  if (bill.paid) return 'paid';
  const todayStr = toISODateString(referenceDate);
  if (bill.dueDate < todayStr) return 'overdue';
  const dueSoonEndStr = toISODateString(addDays(referenceDate, DUE_SOON_WINDOW_DAYS));
  if (bill.dueDate <= dueSoonEndStr) return 'due-soon';
  return 'upcoming';
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
