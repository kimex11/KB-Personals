import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import BudgetPage from './page';

describe('BudgetPage', () => {
  it('composes the summary, donut chart, and one category card per category', () => {
    render(<BudgetPage />);
    expect(screen.getByTestId('budget-page')).toBeInTheDocument();
    expect(screen.getByTestId('budget-summary')).toBeInTheDocument();
    expect(screen.getByTestId('budget-donut-chart')).toBeInTheDocument();
    expect(screen.getAllByTestId('budget-category-card')).toHaveLength(6);
  });
});
