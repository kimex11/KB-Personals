import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import BudgetPage from './page';

describe('BudgetPage', () => {
  it('renders the Budget placeholder', () => {
    render(<BudgetPage />);
    expect(screen.getByText('Budget')).toBeInTheDocument();
  });
});
