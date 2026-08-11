import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tile } from './Tile';

describe('Tile', () => {
  it('renders as a link when href is given', () => {
    render(
      <Tile href="/bills" tintClassName="bg-status-critical/10">
        Bills
      </Tile>
    );
    const tile = screen.getByTestId('tile');
    expect(tile.tagName).toBe('A');
    expect(tile).toHaveAttribute('href', '/bills');
  });

  it('renders as a button and calls onClick when onClick is given', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Tile onClick={onClick} tintClassName="bg-status-critical/10">
        Edit
      </Tile>
    );
    const tile = screen.getByTestId('tile');
    expect(tile.tagName).toBe('BUTTON');
    await user.click(tile);
    expect(onClick).toHaveBeenCalled();
  });

  it('applies the given tint class', () => {
    render(
      <Tile onClick={vi.fn()} tintClassName="bg-status-success/10">
        Paid
      </Tile>
    );
    expect(screen.getByTestId('tile')).toHaveClass('bg-status-success/10');
  });

  it('uses a custom testId when provided', () => {
    render(
      <Tile onClick={vi.fn()} tintClassName="bg-gold/10" testId="launcher-tile-budget">
        Budget
      </Tile>
    );
    expect(screen.getByTestId('launcher-tile-budget')).toBeInTheDocument();
  });

  it('applies an aria-label when provided', () => {
    render(
      <Tile href="/bills" tintClassName="bg-status-critical/10" ariaLabel="Bills, 1 overdue">
        Bills
      </Tile>
    );
    expect(screen.getByLabelText('Bills, 1 overdue')).toBeInTheDocument();
  });
});
