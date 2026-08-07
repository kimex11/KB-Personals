import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import AccountsPage from './page';

describe('AccountsPage', () => {
  it('renders the accounts summary', () => {
    render(<AccountsPage />);
    expect(screen.getByTestId('accounts-summary')).toBeInTheDocument();
  });

  it('renders one row per mock credit card and one row per income source', () => {
    render(<AccountsPage />);
    expect(screen.getAllByTestId('card-due-row').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('income-row').length).toBeGreaterThan(0);
  });

  it('groups content under Credit Card Dues and Income headings', () => {
    render(<AccountsPage />);
    expect(screen.getByRole('heading', { name: 'Credit Card Dues' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Income' })).toBeInTheDocument();
  });
});
