'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listCreditCardDues,
  createCreditCardDue,
  updateCreditCardDue,
  deleteCreditCardDue,
  listIncomeSources,
  createIncomeSource,
  updateIncomeSource,
  deleteIncomeSource,
} from './accounts-repository';
import type { CreditCardDue, IncomeSource, IncomeFrequency } from './accounts-types';
import { logActivity } from './audit-log-repository';

export interface UseAccountsResult {
  cards: CreditCardDue[];
  incomeSources: IncomeSource[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createCard: (input: { cardName: string; last4: string; statementBalance: number; minimumPayment: number; dueDate: string }) => Promise<void>;
  updateCard: (id: string, patch: Partial<Pick<CreditCardDue, 'cardName' | 'last4' | 'statementBalance' | 'minimumPayment' | 'dueDate'>>) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  createIncome: (input: { name: string; amount: number; frequency: IncomeFrequency; nextDate: string }) => Promise<void>;
  updateIncome: (id: string, patch: Partial<Pick<IncomeSource, 'name' | 'amount' | 'frequency' | 'nextDate'>>) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;
}

export function useAccounts(): UseAccountsResult {
  const [cards, setCards] = useState<CreditCardDue[]>([]);
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const [cardRows, incomeRows] = await Promise.all([listCreditCardDues(), listIncomeSources()]);
      if (requestId !== requestIdRef.current) return; // a newer refresh already landed
      setCards(cardRows);
      setIncomeSources(incomeRows);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const runMutation = useCallback(
    async (fn: () => Promise<unknown>) => {
      setError(null);
      try {
        await fn();
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Action failed';
        setError(message);
        throw err;
      }
    },
    [refresh]
  );

  return {
    cards,
    incomeSources,
    loading,
    error,
    refresh,
    createCard: (input) =>
      runMutation(() =>
        createCreditCardDue(input).then((created) => {
          logActivity({
            action: 'create',
            entityType: 'credit_card_due',
            entityId: created.id,
            entityLabel: created.cardName,
            afterValue: { cardName: created.cardName, last4: created.last4, statementBalance: created.statementBalance, minimumPayment: created.minimumPayment, dueDate: created.dueDate },
          }).catch(() => {});
        })
      ),
    updateCard: (id, patch) => {
      const before = cards.find((c) => c.id === id);
      return runMutation(() =>
        updateCreditCardDue(id, patch).then(() => {
          logActivity({
            action: 'update',
            entityType: 'credit_card_due',
            entityId: id,
            entityLabel: patch.cardName ?? before?.cardName ?? 'Card',
            beforeValue: before
              ? { cardName: before.cardName, last4: before.last4, statementBalance: before.statementBalance, minimumPayment: before.minimumPayment, dueDate: before.dueDate }
              : null,
            afterValue: { ...before, ...patch },
          }).catch(() => {});
        })
      );
    },
    deleteCard: (id) => {
      const before = cards.find((c) => c.id === id);
      return runMutation(() =>
        deleteCreditCardDue(id).then(() => {
          logActivity({
            action: 'delete',
            entityType: 'credit_card_due',
            entityId: id,
            entityLabel: before?.cardName ?? 'Card',
            beforeValue: before ? { cardName: before.cardName, last4: before.last4, statementBalance: before.statementBalance, dueDate: before.dueDate } : null,
          }).catch(() => {});
        })
      );
    },
    createIncome: (input) =>
      runMutation(() =>
        createIncomeSource(input).then((created) => {
          logActivity({
            action: 'create',
            entityType: 'income_source',
            entityId: created.id,
            entityLabel: created.name,
            afterValue: { name: created.name, amount: created.amount, frequency: created.frequency, nextDate: created.nextDate },
          }).catch(() => {});
        })
      ),
    updateIncome: (id, patch) => {
      const before = incomeSources.find((i) => i.id === id);
      return runMutation(() =>
        updateIncomeSource(id, patch).then(() => {
          logActivity({
            action: 'update',
            entityType: 'income_source',
            entityId: id,
            entityLabel: patch.name ?? before?.name ?? 'Income',
            beforeValue: before ? { name: before.name, amount: before.amount, frequency: before.frequency, nextDate: before.nextDate } : null,
            afterValue: { ...before, ...patch },
          }).catch(() => {});
        })
      );
    },
    deleteIncome: (id) => {
      const before = incomeSources.find((i) => i.id === id);
      return runMutation(() =>
        deleteIncomeSource(id).then(() => {
          logActivity({
            action: 'delete',
            entityType: 'income_source',
            entityId: id,
            entityLabel: before?.name ?? 'Income',
            beforeValue: before ? { name: before.name, amount: before.amount, frequency: before.frequency, nextDate: before.nextDate } : null,
          }).catch(() => {});
        })
      );
    },
  };
}
