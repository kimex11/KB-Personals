import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityLogFilterBar } from './ActivityLogFilterBar';

const noop = () => {};

describe('ActivityLogFilterBar', () => {
  it('calls onQueryChange when the search input changes', () => {
    const onQueryChange = vi.fn();
    render(
      <ActivityLogFilterBar
        query=""
        onQueryChange={onQueryChange}
        actionFilter="all"
        onActionFilterChange={noop}
        entityTypeFilter="all"
        onEntityTypeFilterChange={noop}
        dateFrom={null}
        onDateFromChange={noop}
        dateTo={null}
        onDateToChange={noop}
      />
    );
    fireEvent.change(screen.getByTestId('activity-search-input'), { target: { value: 'rent' } });
    expect(onQueryChange).toHaveBeenCalledWith('rent');
  });

  it('marks the active action chip as pressed', () => {
    render(
      <ActivityLogFilterBar
        query=""
        onQueryChange={noop}
        actionFilter="delete"
        onActionFilterChange={noop}
        entityTypeFilter="all"
        onEntityTypeFilterChange={noop}
        dateFrom={null}
        onDateFromChange={noop}
        dateTo={null}
        onDateToChange={noop}
      />
    );
    expect(screen.getByTestId('activity-filter-delete')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('activity-filter-all')).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onActionFilterChange when an action chip is clicked', () => {
    const onActionFilterChange = vi.fn();
    render(
      <ActivityLogFilterBar
        query=""
        onQueryChange={noop}
        actionFilter="all"
        onActionFilterChange={onActionFilterChange}
        entityTypeFilter="all"
        onEntityTypeFilterChange={noop}
        dateFrom={null}
        onDateFromChange={noop}
        dateTo={null}
        onDateToChange={noop}
      />
    );
    fireEvent.click(screen.getByTestId('activity-filter-create'));
    expect(onActionFilterChange).toHaveBeenCalledWith('create');
  });

  it('calls onEntityTypeFilterChange when the module select changes', () => {
    const onEntityTypeFilterChange = vi.fn();
    render(
      <ActivityLogFilterBar
        query=""
        onQueryChange={noop}
        actionFilter="all"
        onActionFilterChange={noop}
        entityTypeFilter="all"
        onEntityTypeFilterChange={onEntityTypeFilterChange}
        dateFrom={null}
        onDateFromChange={noop}
        dateTo={null}
        onDateToChange={noop}
      />
    );
    fireEvent.change(screen.getByTestId('activity-entity-type-select'), { target: { value: 'category' } });
    expect(onEntityTypeFilterChange).toHaveBeenCalledWith('category');
  });

  it('calls onDateFromChange and onDateToChange when the date inputs change', () => {
    const onDateFromChange = vi.fn();
    const onDateToChange = vi.fn();
    render(
      <ActivityLogFilterBar
        query=""
        onQueryChange={noop}
        actionFilter="all"
        onActionFilterChange={noop}
        entityTypeFilter="all"
        onEntityTypeFilterChange={noop}
        dateFrom={null}
        onDateFromChange={onDateFromChange}
        dateTo={null}
        onDateToChange={onDateToChange}
      />
    );
    fireEvent.change(screen.getByTestId('activity-date-from-input'), { target: { value: '2026-08-01' } });
    expect(onDateFromChange).toHaveBeenCalledWith('2026-08-01');
    fireEvent.change(screen.getByTestId('activity-date-to-input'), { target: { value: '2026-08-31' } });
    expect(onDateToChange).toHaveBeenCalledWith('2026-08-31');
  });
});
