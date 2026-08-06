import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import BillsPage from './page';

describe('BillsPage', () => {
  it('renders the Bills placeholder', () => {
    render(<BillsPage />);
    expect(screen.getByText('Bills')).toBeInTheDocument();
  });
});
