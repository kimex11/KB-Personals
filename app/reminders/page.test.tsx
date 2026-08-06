import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import RemindersPage from './page';

describe('RemindersPage', () => {
  it('renders the Reminders placeholder', () => {
    render(<RemindersPage />);
    expect(screen.getByText('Reminders')).toBeInTheDocument();
  });
});
