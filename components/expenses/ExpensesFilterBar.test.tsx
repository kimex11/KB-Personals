import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { ExpensesFilterBar } from './ExpensesFilterBar';

const categories = [
  { id: 'cat-1', name: 'Groceries' },
  { id: 'cat-2', name: 'Transport' },
];

const noop = () => {};

describe('ExpensesFilterBar', () => {
  it('calls onQueryChange when the search input changes', () => {
    const onQueryChange = vi.fn();
    render(<ExpensesFilterBar query="" onQueryChange={onQueryChange} categoryFilter="all" onCategoryFilterChange={noop} categories={categories} />);
    fireEvent.change(screen.getByTestId('expenses-search-input'), { target: { value: 'gas' } });
    expect(onQueryChange).toHaveBeenCalledWith('gas');
  });

  it('lists every category plus an "all" option', () => {
    render(<ExpensesFilterBar query="" onQueryChange={noop} categoryFilter="all" onCategoryFilterChange={noop} categories={categories} />);
    const select = screen.getByTestId('expenses-category-select');
    expect(select).toHaveTextContent('Groceries');
    expect(select).toHaveTextContent('Transport');
    expect(select).toHaveTextContent('All categories');
  });

  it('calls onCategoryFilterChange when the category select changes', () => {
    const onCategoryFilterChange = vi.fn();
    render(<ExpensesFilterBar query="" onQueryChange={noop} categoryFilter="all" onCategoryFilterChange={onCategoryFilterChange} categories={categories} />);
    fireEvent.change(screen.getByTestId('expenses-category-select'), { target: { value: 'cat-2' } });
    expect(onCategoryFilterChange).toHaveBeenCalledWith('cat-2');
  });
});
