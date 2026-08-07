import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Home } from 'lucide-react';
import { BudgetDonutChart } from './BudgetDonutChart';
import type { BudgetCategory } from '@/lib/budget-types';

const categories: BudgetCategory[] = [
  { id: 'a', name: 'Category A', icon: Home, colorSlot: 1, limit: 100, spent: 60 },
  { id: 'b', name: 'Category B', icon: Home, colorSlot: 2, limit: 50, spent: 40 },
];

describe('BudgetDonutChart', () => {
  it('renders one slice and one legend row per category', () => {
    render(<BudgetDonutChart categories={categories} />);
    expect(screen.getAllByTestId('donut-slice')).toHaveLength(2);
    expect(screen.getAllByTestId('legend-row')).toHaveLength(2);
  });

  it('shows each category name and spent amount in the legend', () => {
    render(<BudgetDonutChart categories={categories} />);
    expect(screen.getByText('Category A')).toBeInTheDocument();
    expect(screen.getByText('$60')).toBeInTheDocument();
    expect(screen.getByText('Category B')).toBeInTheDocument();
    expect(screen.getByText('$40')).toBeInTheDocument();
  });
});
