import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Home } from 'lucide-react';
import { BudgetCategoryCard } from './BudgetCategoryCard';
import type { BudgetCategory } from '@/lib/budget-types';

const underBudget: BudgetCategory = {
  id: 'a',
  name: 'Groceries',
  icon: Home,
  colorSlot: 2,
  limit: 500,
  spent: 400,
};

const overBudget: BudgetCategory = {
  id: 'b',
  name: 'Entertainment',
  icon: Home,
  colorSlot: 4,
  limit: 120,
  spent: 138,
};

describe('BudgetCategoryCard', () => {
  it('shows progress bar width proportional to spent/limit when under budget', () => {
    render(<BudgetCategoryCard category={underBudget} />);
    expect(screen.getByTestId('progress-bar-fill')).toHaveStyle({ width: '80%' });
    expect(screen.queryByTestId('over-budget-label')).not.toBeInTheDocument();
  });

  it('shows the over-budget label and status-critical fill when spent exceeds limit', () => {
    render(<BudgetCategoryCard category={overBudget} />);
    expect(screen.getByTestId('over-budget-label')).toHaveTextContent('Over budget');
    expect(screen.getByTestId('progress-bar-fill').className).toContain('bg-status-critical');
  });

  it('caps the progress bar width at 100% even when far over budget', () => {
    const wayOver: BudgetCategory = { id: 'c', name: 'X', icon: Home, colorSlot: 1, limit: 100, spent: 500 };
    render(<BudgetCategoryCard category={wayOver} />);
    expect(screen.getByTestId('progress-bar-fill')).toHaveStyle({ width: '100%' });
  });

  it('displays the spent-of-limit amounts', () => {
    render(<BudgetCategoryCard category={underBudget} />);
    expect(screen.getByText('₱400 of ₱500')).toBeInTheDocument();
  });

  it('does not produce an invalid (NaN) width when both limit and spent are zero', () => {
    const untouched: BudgetCategory = { id: 'd', name: 'Unbudgeted', icon: Home, colorSlot: 1, limit: 0, spent: 0 };
    render(<BudgetCategoryCard category={untouched} />);
    expect(screen.getByTestId('progress-bar-fill')).toHaveStyle({ width: '0%' });
  });

  it('tints the card background to match its color slot', () => {
    render(<BudgetCategoryCard category={underBudget} />);
    expect(screen.getByTestId('budget-category-card')).toHaveClass('bg-budget-2/8');
  });
});
