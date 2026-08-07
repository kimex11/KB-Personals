import { describe, expect, it } from 'vitest';
import { getDueStatus, totalStatementBalance, monthlyEquivalentIncome, totalMonthlyIncome } from './accounts-selectors';
import type { CreditCardDue, IncomeSource } from './accounts-types';

const referenceDate = new Date(2026, 7, 15); // 2026-08-15

const cards: CreditCardDue[] = [
  { id: '1', cardName: 'Overdue Card', last4: '1111', statementBalance: 500, minimumPayment: 25, dueDate: '2026-08-10' },
  { id: '2', cardName: 'Due Soon Card', last4: '2222', statementBalance: 300, minimumPayment: 15, dueDate: '2026-08-16' },
  { id: '3', cardName: 'Upcoming Card', last4: '3333', statementBalance: 200, minimumPayment: 10, dueDate: '2026-08-25' },
];

describe('getDueStatus', () => {
  it('returns "overdue" for a due date before the reference date', () => {
    expect(getDueStatus(cards[0], referenceDate)).toBe('overdue');
  });

  it('returns "due-soon" for a due date within 3 days', () => {
    expect(getDueStatus(cards[1], referenceDate)).toBe('due-soon');
  });

  it('returns "upcoming" for a due date more than 3 days out', () => {
    expect(getDueStatus(cards[2], referenceDate)).toBe('upcoming');
  });
});

describe('totalStatementBalance', () => {
  it('sums the statement balances of all cards', () => {
    expect(totalStatementBalance(cards)).toBe(1000);
  });
});

describe('monthlyEquivalentIncome', () => {
  const weekly: IncomeSource = { id: 'w', name: 'Freelance', amount: 100, frequency: 'weekly', nextDate: '2026-08-20' };
  const biweekly: IncomeSource = { id: 'b', name: 'Salary', amount: 1000, frequency: 'biweekly', nextDate: '2026-08-20' };
  const monthly: IncomeSource = { id: 'm', name: 'Rental', amount: 500, frequency: 'monthly', nextDate: '2026-08-20' };

  it('multiplies weekly income by ~4.33', () => {
    expect(monthlyEquivalentIncome(weekly)).toBeCloseTo(433, 0);
  });

  it('multiplies biweekly income by ~2.166', () => {
    expect(monthlyEquivalentIncome(biweekly)).toBeCloseTo(2166, 0);
  });

  it('leaves monthly income unchanged', () => {
    expect(monthlyEquivalentIncome(monthly)).toBe(500);
  });
});

describe('totalMonthlyIncome', () => {
  it('sums the monthly-equivalent amounts of all sources', () => {
    const sources: IncomeSource[] = [
      { id: 'm1', name: 'Salary', amount: 3000, frequency: 'monthly', nextDate: '2026-08-20' },
      { id: 'm2', name: 'Side Gig', amount: 200, frequency: 'monthly', nextDate: '2026-08-20' },
    ];
    expect(totalMonthlyIncome(sources)).toBe(3200);
  });
});
