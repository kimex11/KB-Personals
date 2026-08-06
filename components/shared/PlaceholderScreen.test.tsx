import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PieChart } from 'lucide-react';
import { PlaceholderScreen } from './PlaceholderScreen';

describe('PlaceholderScreen', () => {
  it('renders the given icon and a coming-soon message', () => {
    render(<PlaceholderScreen icon={PieChart} />);
    expect(screen.getByTestId('placeholder-screen')).toBeInTheDocument();
    expect(screen.getByTestId('placeholder-screen-icon')).toBeInTheDocument();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
  });
});
