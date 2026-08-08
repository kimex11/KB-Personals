import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationSettings } from './NotificationSettings';

const baseProps = {
  onRequestPermission: vi.fn(),
  soundEnabled: true,
  onToggleSound: vi.fn(),
  quietHoursStart: null,
  quietHoursEnd: null,
  onQuietHoursChange: vi.fn(),
  enabledPriorities: ['critical', 'urgent', 'reminder'] as const,
  onTogglePriority: vi.fn(),
};

describe('NotificationSettings', () => {
  it('shows an Enable button when permission has not been decided', () => {
    render(<NotificationSettings {...baseProps} permission="default" />);
    expect(screen.getByTestId('enable-notifications-button')).toBeInTheDocument();
    expect(screen.queryByTestId('sound-toggle-button')).not.toBeInTheDocument();
  });

  it('calls onRequestPermission when Enable is clicked', () => {
    const onRequestPermission = vi.fn();
    render(<NotificationSettings {...baseProps} permission="default" onRequestPermission={onRequestPermission} />);
    fireEvent.click(screen.getByTestId('enable-notifications-button'));
    expect(onRequestPermission).toHaveBeenCalled();
  });

  it('shows the sound toggle, quiet hours, and priority toggles once permission is granted', () => {
    render(<NotificationSettings {...baseProps} permission="granted" />);
    expect(screen.queryByTestId('enable-notifications-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('sound-toggle-button')).toBeInTheDocument();
    expect(screen.getByTestId('quiet-hours-start')).toBeInTheDocument();
    expect(screen.getByTestId('quiet-hours-end')).toBeInTheDocument();
    expect(screen.getByTestId('priority-toggle-critical')).toBeInTheDocument();
    expect(screen.getByTestId('priority-toggle-urgent')).toBeInTheDocument();
    expect(screen.getByTestId('priority-toggle-reminder')).toBeInTheDocument();
  });

  it('calls onToggleSound when the sound button is clicked', () => {
    const onToggleSound = vi.fn();
    render(<NotificationSettings {...baseProps} permission="granted" onToggleSound={onToggleSound} />);
    fireEvent.click(screen.getByTestId('sound-toggle-button'));
    expect(onToggleSound).toHaveBeenCalled();
  });

  it('calls onQuietHoursChange when the start time changes', () => {
    const onQuietHoursChange = vi.fn();
    render(<NotificationSettings {...baseProps} permission="granted" onQuietHoursChange={onQuietHoursChange} />);
    fireEvent.change(screen.getByTestId('quiet-hours-start'), { target: { value: '22:00' } });
    expect(onQuietHoursChange).toHaveBeenCalledWith('22:00', null);
  });

  it('calls onTogglePriority when a priority checkbox is clicked', () => {
    const onTogglePriority = vi.fn();
    render(<NotificationSettings {...baseProps} permission="granted" onTogglePriority={onTogglePriority} />);
    fireEvent.click(screen.getByTestId('priority-toggle-reminder'));
    expect(onTogglePriority).toHaveBeenCalledWith('reminder');
  });

  it('shows a blocked message with re-enable instructions when permission is denied', () => {
    render(<NotificationSettings {...baseProps} permission="denied" />);
    expect(screen.getByTestId('notification-settings')).toHaveTextContent('Blocked');
    expect(screen.getByTestId('notification-settings')).toHaveTextContent('browser');
    expect(screen.queryByTestId('enable-notifications-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sound-toggle-button')).not.toBeInTheDocument();
  });

  it('shows an unsupported message with no action buttons when push is unavailable', () => {
    render(<NotificationSettings {...baseProps} permission="unsupported" />);
    expect(screen.getByTestId('notification-settings')).toHaveTextContent('Not supported');
    expect(screen.queryByTestId('enable-notifications-button')).not.toBeInTheDocument();
  });
});
