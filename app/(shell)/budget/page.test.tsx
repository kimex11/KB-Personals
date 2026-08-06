import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import BudgetPage from './page';

describe('BudgetPage', () => {
  it('renders the placeholder screen with an icon and coming-soon message', () => {
    render(<BudgetPage />);
    expect(screen.getByTestId('placeholder-screen')).toBeInTheDocument();
    expect(screen.getByTestId('placeholder-screen-icon')).toBeInTheDocument();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
  });
});
