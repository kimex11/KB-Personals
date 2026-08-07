import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GoalProgressPanel } from './GoalProgressPanel';
import type { SavingsGoal } from '@/lib/dashboard-types';

const goal: SavingsGoal = { id: 'g1', title: 'Emergency Fund', saved: 3000, target: 6000 };

describe('GoalProgressPanel', () => {
  it('shows the goal title and saved-of-target amounts', () => {
    render(<GoalProgressPanel goal={goal} />);
    expect(screen.getByTestId('goal-progress-panel')).toHaveTextContent('Emergency Fund');
    expect(screen.getByTestId('goal-progress-panel')).toHaveTextContent('₱3000 of ₱6000 saved');
  });

  it('sets the progress fill width proportional to saved/target', () => {
    render(<GoalProgressPanel goal={goal} />);
    expect(screen.getByTestId('goal-progress-fill')).toHaveStyle({ width: '50%' });
  });

  it('caps the progress fill at 100% when saved exceeds target', () => {
    const overGoal: SavingsGoal = { id: 'g2', title: 'Trip Fund', saved: 700, target: 500 };
    render(<GoalProgressPanel goal={overGoal} />);
    expect(screen.getByTestId('goal-progress-fill')).toHaveStyle({ width: '100%' });
  });
});
