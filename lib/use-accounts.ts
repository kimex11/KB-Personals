'use client';

import { useCallback, useEffect, useState } from 'react';
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

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cardRows, incomeRows] = await Promise.all([listCreditCardDues(), listIncomeSources()]);
      setCards(cardRows);
      setIncomeSources(incomeRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
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
    createCard: (input) => runMutation(() => createCreditCardDue(input)),
    updateCard: (id, patch) => runMutation(() => updateCreditCardDue(id, patch)),
    deleteCard: (id) => runMutation(() => deleteCreditCardDue(id)),
    createIncome: (input) => runMutation(() => createIncomeSource(input)),
    updateIncome: (id, patch) => runMutation(() => updateIncomeSource(id, patch)),
    deleteIncome: (id) => runMutation(() => deleteIncomeSource(id)),
  };
}
