'use client';

import { useMemo } from 'react';
import type { Bill } from './bills-types';
import type { Reminder } from './reminders-types';
import type { Expense } from './expenses-repository';
import type { CreditCardPayment } from './credit-card-payments-repository';
import type { CreditCardDue } from './accounts-types';
import type { PaymentPlanPayment } from './payment-plan-payments-repository';
import type { PaymentPlan } from './payment-plans-repository';
import type { CalendarEvent } from './types';
import { toISODateString } from './date-utils';

export interface CalendarEventSources {
  expenses?: Expense[];
  cardPayments?: CreditCardPayment[];
  cards?: CreditCardDue[];
  planPayments?: PaymentPlanPayment[];
  plans?: PaymentPlan[];
}

export function useCalendarEvents(bills: Bill[], reminders: Reminder[], sources: CalendarEventSources = {}) {
  const { expenses = [], cardPayments = [], cards = [], planPayments = [], plans = [] } = sources;

  const events = useMemo<CalendarEvent[]>(() => {
    const billEvents: CalendarEvent[] = bills.map((bill) => ({
      id: bill.id,
      type: 'bill',
      title: bill.title,
      date: bill.dueDate,
      amount: bill.amount,
    }));
    const reminderEvents: CalendarEvent[] = reminders.map((reminder) => ({
      id: reminder.id,
      type: 'reminder',
      title: reminder.title,
      date: reminder.dueDate,
    }));
    const expenseEvents: CalendarEvent[] = expenses.map((expense) => ({
      id: `expense:${expense.id}`,
      type: 'expense',
      title: expense.description ?? expense.category,
      date: expense.date,
      amount: expense.amount,
    }));
    const cardPaymentEvents: CalendarEvent[] = cardPayments.map((payment) => {
      const cardName = cards.find((card) => card.id === payment.cardId)?.cardName ?? 'Card payment';
      return {
        id: `card-payment:${payment.id}`,
        type: 'payment',
        title: `${cardName} payment`,
        date: payment.paidAt.slice(0, 10),
        amount: payment.amount,
      };
    });
    const planPaymentEvents: CalendarEvent[] = planPayments.map((payment) => {
      const plan = plans.find((p) => p.id === payment.planId);
      const title = plan
        ? `${plan.name} · Installment ${payment.installmentNumber} of ${plan.installmentCount}`
        : `Installment ${payment.installmentNumber}`;
      return {
        id: `plan-payment:${payment.id}`,
        type: 'payment',
        title,
        date: payment.paidAt.slice(0, 10),
        amount: payment.amount,
      };
    });
    return [...billEvents, ...reminderEvents, ...expenseEvents, ...cardPaymentEvents, ...planPaymentEvents];
  }, [bills, reminders, expenses, cardPayments, cards, planPayments, plans]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const existing = map.get(event.date) ?? [];
      existing.push(event);
      map.set(event.date, existing);
    }
    return map;
  }, [events]);

  function getEventsForDate(date: Date): CalendarEvent[] {
    return eventsByDate.get(toISODateString(date)) ?? [];
  }

  return { events, getEventsForDate };
}
