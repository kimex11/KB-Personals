import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationSettings } from './NotificationSettings';

describe('NotificationSettings', () => {
  it('shows an Enable button when permission has not been decided', () => {
    render(
      <NotificationSettings permission="default" onRequestPermission={vi.fn()} soundEnabled={true} onToggleSound={vi.fn()} />
    );
    expect(screen.getByTestId('enable-notifications-button')).toBeInTheDocument();
    expect(screen.queryByTestId('sound-toggle-button')).not.toBeInTheDocument();
  });

  it('calls onRequestPermission when Enable is clicked', () => {
    const onRequestPermission = vi.fn();
    render(
      <NotificationSettings
        permission="default"
        onRequestPermission={onRequestPermission}
        soundEnabled={true}
        onToggleSound={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('enable-notifications-button'));
    expect(onRequestPermission).toHaveBeenCalled();
  });

  it('shows the sound toggle instead of Enable once permission is granted', () => {
    render(
      <NotificationSettings permission="granted" onRequestPermission={vi.fn()} soundEnabled={true} onToggleSound={vi.fn()} />
    );
    expect(screen.queryByTestId('enable-notifications-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('sound-toggle-button')).toBeInTheDocument();
  });

  it('calls onToggleSound when the sound button is clicked', () => {
    const onToggleSound = vi.fn();
    render(
      <NotificationSettings permission="granted" onRequestPermission={vi.fn()} soundEnabled={true} onToggleSound={onToggleSound} />
    );
    fireEvent.click(screen.getByTestId('sound-toggle-button'));
    expect(onToggleSound).toHaveBeenCalled();
  });

  it('shows a blocked message when permission is denied, with no action buttons', () => {
    render(
      <NotificationSettings permission="denied" onRequestPermission={vi.fn()} soundEnabled={true} onToggleSound={vi.fn()} />
    );
    expect(screen.getByTestId('notification-settings')).toHaveTextContent('Blocked');
    expect(screen.queryByTestId('enable-notifications-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sound-toggle-button')).not.toBeInTheDocument();
  });
});
