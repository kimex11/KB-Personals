import { describe, expect, it } from 'vitest';
import { getDueStatus, totalIncome } from './accounts-selectors';
import type { CreditCardDue, IncomeSource } from './accounts-types';

const referenceDate = new Date(2026, 7, 15); // 2026-08-15

const cards: CreditCardDue[] = [
  { id: '1', cardName: 'Overdue Card', last4: '1111', statementBalance: 500, minimumPayment: 25, dueDate: '2026-08-10', balanceAnchorAt: '2026-07-01T00:00:00.000Z', imageUrl: null, imageStoragePath: null },
  { id: '2', cardName: 'Due Soon Card', last4: '2222', statementBalance: 300, minimumPayment: 15, dueDate: '2026-08-16', balanceAnchorAt: '2026-07-01T00:00:00.000Z', imageUrl: null, imageStoragePath: null },
  { id: '3', cardName: 'Upcoming Card', last4: '3333', statementBalance: 200, minimumPayment: 10, dueDate: '2026-08-25', balanceAnchorAt: '2026-07-01T00:00:00.000Z', imageUrl: null, imageStoragePath: null },
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

describe('totalIncome', () => {
  it('sums the amounts of all income sources', () => {
    const sources: IncomeSource[] = [
      { id: 'm1', name: 'Salary', amount: 3000, date: '2026-08-20' },
      { id: 'm2', name: 'Side Gig', amount: 200, date: '2026-08-20' },
    ];
    expect(totalIncome(sources)).toBe(3200);
  });
});
