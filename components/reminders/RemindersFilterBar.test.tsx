import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RemindersFilterBar } from './RemindersFilterBar';

describe('RemindersFilterBar', () => {
  it('calls onQueryChange when the search input changes', () => {
    const onQueryChange = vi.fn();
    render(
      <RemindersFilterBar
        query=""
        onQueryChange={onQueryChange}
        priorityFilter="all"
        onPriorityFilterChange={vi.fn()}
        sortBy="dueDate"
        onSortByChange={vi.fn()}
      />
    );
    fireEvent.change(screen.getByTestId('reminders-search-input'), { target: { value: 'passport' } });
    expect(onQueryChange).toHaveBeenCalledWith('passport');
  });

  it('calls onPriorityFilterChange when a filter chip is clicked', () => {
    const onPriorityFilterChange = vi.fn();
    render(
      <RemindersFilterBar
        query=""
        onQueryChange={vi.fn()}
        priorityFilter="all"
        onPriorityFilterChange={onPriorityFilterChange}
        sortBy="dueDate"
        onSortByChange={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('reminders-filter-high'));
    expect(onPriorityFilterChange).toHaveBeenCalledWith('high');
  });

  it('marks the active filter chip as pressed', () => {
    render(
      <RemindersFilterBar
        query=""
        onQueryChange={vi.fn()}
        priorityFilter="high"
        onPriorityFilterChange={vi.fn()}
        sortBy="dueDate"
        onSortByChange={vi.fn()}
      />
    );
    expect(screen.getByTestId('reminders-filter-high')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('reminders-filter-all')).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onSortByChange when the sort select changes', () => {
    const onSortByChange = vi.fn();
    render(
      <RemindersFilterBar
        query=""
        onQueryChange={vi.fn()}
        priorityFilter="all"
        onPriorityFilterChange={vi.fn()}
        sortBy="dueDate"
        onSortByChange={onSortByChange}
      />
    );
    fireEvent.change(screen.getByTestId('reminders-sort-select'), { target: { value: 'priority' } });
    expect(onSortByChange).toHaveBeenCalledWith('priority');
  });
});
