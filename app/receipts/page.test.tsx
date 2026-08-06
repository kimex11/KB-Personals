import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReceiptsPage from './page';

describe('ReceiptsPage', () => {
  it('renders the Receipts placeholder', () => {
    render(<ReceiptsPage />);
    expect(screen.getByText('Receipts')).toBeInTheDocument();
  });
});
