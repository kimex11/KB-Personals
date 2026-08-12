import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCalendarEvents } from './use-calendar-events';
import type { Bill } from './bills-types';
import type { Reminder } from './reminders-types';
import type { Expense } from './expenses-repository';
import type { CreditCardPayment } from './credit-card-payments-repository';
import type { CreditCardDue } from './accounts-types';
import type { PaymentPlanPayment } from './payment-plan-payments-repository';
import type { PaymentPlan } from './payment-plans-repository';

const bills: Bill[] = [
  { id: 'bill-1', title: 'Test Bill', category: 'Utilities', amount: 10, dueDate: '2026-08-10', recurrence: null, paid: false, seriesId: null, cycleNumber: null, skipped: false },
];

const reminders: Reminder[] = [
  { id: 'reminder-1', title: 'Test Reminder', category: 'Personal', dueDate: '2026-08-10', priority: 'medium', completed: false, seriesId: null, cycleNumber: null, skipped: false },
];

describe('useCalendarEvents', () => {
  it('derives calendar events from the given bills and reminders, grouped by ISO date', () => {
    const { result } = renderHook(() => useCalendarEvents(bills, reminders));
    const events = result.current.getEventsForDate(new Date(2026, 7, 10));
    expect(events).toHaveLength(2);
    expect(events).toContainEqual({ id: 'bill-1', type: 'bill', title: 'Test Bill', date: '2026-08-10', amount: 10 });
    expect(events).toContainEqual({ id: 'reminder-1', type: 'reminder', title: 'Test Reminder', date: '2026-08-10' });
  });

  it('returns an empty array for a date with no events', () => {
    const { result } = renderHook(() => useCalendarEvents(bills, reminders));
    const events = result.current.getEventsForDate(new Date(2099, 0, 1));
    expect(events).toEqual([]);
  });

  it('includes expenses, card payments, and plan payments as calendar events', () => {
    const expenses: Expense[] = [
      { id: 'exp-1', categoryId: 'cat-1', category: 'Groceries', categoryColorSlot: 2, amount: 850, date: '2026-08-12', description: 'Weekly run', paymentMethod: 'Cash' },
    ];
    const cards: CreditCardDue[] = [
      { id: 'card-1', cardName: 'Visa Platinum', last4: '4821', statementBalance: 542.5, minimumPayment: 45, dueDate: '2026-08-20' },
    ];
    const cardPayments: CreditCardPayment[] = [
      { id: 'pay-1', cardId: 'card-1', amount: 300, balanceBefore: 842.5, balanceAfter: 542.5, paidAt: '2026-08-12T10:00:00.000Z', method: 'Bank transfer', notes: null },
    ];
    const plans: PaymentPlan[] = [
      { id: 'plan-1', name: 'iPhone 15', categoryId: 'cat-2', category: 'Electronics', categoryColorSlot: 4, totalAmount: 36000, installmentCount: 12, monthlyAmount: 3000, startDate: '2026-01-01' },
    ];
    const planPayments: PaymentPlanPayment[] = [
      { id: 'pp-1', planId: 'plan-1', installmentNumber: 3, amount: 3000, balanceBefore: 12000, balanceAfter: 9000, paidAt: '2026-08-12T09:00:00.000Z' },
    ];

    const { result } = renderHook(() => useCalendarEvents(bills, reminders, { expenses, cardPayments, cards, planPayments, plans }));
    const events = result.current.getEventsForDate(new Date(2026, 7, 12));

    expect(events).toContainEqual({ id: 'expense:exp-1', type: 'expense', title: 'Weekly run', date: '2026-08-12', amount: 850 });
    expect(events).toContainEqual({ id: 'card-payment:pay-1', type: 'payment', title: 'Visa Platinum payment', date: '2026-08-12', amount: 300 });
    expect(events).toContainEqual({
      id: 'plan-payment:pp-1',
      type: 'payment',
      title: 'iPhone 15 · Installment 3 of 12',
      date: '2026-08-12',
      amount: 3000,
    });
  });
});
