import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IncomeRow } from './IncomeRow';
import type { IncomeSource } from '@/lib/accounts-types';

const referenceDate = new Date(2026, 7, 15);

const source: IncomeSource = {
  id: '1',
  name: 'Salary',
  amount: 3200,
  frequency: 'biweekly',
  nextDate: '2026-08-20',
};

describe('IncomeRow', () => {
  it('shows name, amount, frequency, and next date', () => {
    render(<IncomeRow source={source} referenceDate={referenceDate} />);
    const row = screen.getByTestId('income-row');
    expect(row).toHaveTextContent('Salary');
    expect(row).toHaveTextContent('₱3200.00');
    expect(row).toHaveTextContent('Biweekly');
  });
});
