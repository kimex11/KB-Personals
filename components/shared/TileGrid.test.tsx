import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TileGrid } from './TileGrid';

describe('TileGrid', () => {
  it('renders children in a 2-column grid', () => {
    render(
      <TileGrid>
        <div>A</div>
        <div>B</div>
      </TileGrid>
    );
    const grid = screen.getByTestId('tile-grid');
    expect(grid).toHaveClass('grid-cols-2');
    expect(grid).toHaveTextContent('A');
    expect(grid).toHaveTextContent('B');
  });

  it('uses a custom testId when provided', () => {
    render(
      <TileGrid testId="launcher-tiles">
        <div>A</div>
      </TileGrid>
    );
    expect(screen.getByTestId('launcher-tiles')).toBeInTheDocument();
  });
});
