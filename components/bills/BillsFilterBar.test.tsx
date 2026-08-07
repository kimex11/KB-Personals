import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BillsFilterBar } from './BillsFilterBar';

describe('BillsFilterBar', () => {
  it('calls onQueryChange when the search input changes', () => {
    const onQueryChange = vi.fn();
    render(
      <BillsFilterBar
        query=""
        onQueryChange={onQueryChange}
        statusFilter="all"
        onStatusFilterChange={vi.fn()}
        sortBy="dueDate"
        onSortByChange={vi.fn()}
      />
    );
    fireEvent.change(screen.getByTestId('bills-search-input'), { target: { value: 'rent' } });
    expect(onQueryChange).toHaveBeenCalledWith('rent');
  });

  it('calls onStatusFilterChange when a filter chip is clicked', () => {
    const onStatusFilterChange = vi.fn();
    render(
      <BillsFilterBar
        query=""
        onQueryChange={vi.fn()}
        statusFilter="all"
        onStatusFilterChange={onStatusFilterChange}
        sortBy="dueDate"
        onSortByChange={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('bills-filter-overdue'));
    expect(onStatusFilterChange).toHaveBeenCalledWith('overdue');
  });

  it('marks the active filter chip as pressed', () => {
    render(
      <BillsFilterBar
        query=""
        onQueryChange={vi.fn()}
        statusFilter="overdue"
        onStatusFilterChange={vi.fn()}
        sortBy="dueDate"
        onSortByChange={vi.fn()}
      />
    );
    expect(screen.getByTestId('bills-filter-overdue')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('bills-filter-all')).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onSortByChange when the sort select changes', () => {
    const onSortByChange = vi.fn();
    render(
      <BillsFilterBar
        query=""
        onQueryChange={vi.fn()}
        statusFilter="all"
        onStatusFilterChange={vi.fn()}
        sortBy="dueDate"
        onSortByChange={onSortByChange}
      />
    );
    fireEvent.change(screen.getByTestId('bills-sort-select'), { target: { value: 'amount' } });
    expect(onSortByChange).toHaveBeenCalledWith('amount');
  });
});
