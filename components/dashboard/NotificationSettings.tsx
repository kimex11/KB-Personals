'use client';

import { Bell, BellOff, Volume2, VolumeX } from 'lucide-react';

interface NotificationSettingsProps {
  permission: NotificationPermission;
  onRequestPermission: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

const STATUS_TEXT: Record<NotificationPermission, string> = {
  granted: 'Enabled',
  denied: 'Blocked in browser settings',
  default: 'Get notified about overdue bills',
};

export function NotificationSettings({
  permission,
  onRequestPermission,
  soundEnabled,
  onToggleSound,
}: NotificationSettingsProps) {
  return (
    <div
      data-testid="notification-settings"
      className="flex items-center justify-between gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3"
    >
      <div className="flex items-center gap-2">
        {permission === 'granted' ? (
          <Bell className="h-4 w-4 text-gold" />
        ) : (
          <BellOff className="h-4 w-4 text-neutral-400" />
        )}
        <div>
          <p className="text-sm font-medium text-neutral-900">Alerts</p>
          <p className="text-xs text-neutral-500">{STATUS_TEXT[permission]}</p>
        </div>
      </div>
      {permission === 'default' && (
        <button
          type="button"
          data-testid="enable-notifications-button"
          onClick={onRequestPermission}
          className="rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white"
        >
          Enable
        </button>
      )}
      {permission === 'granted' && (
        <button
          type="button"
          data-testid="sound-toggle-button"
          aria-label={soundEnabled ? 'Mute alert sound' : 'Unmute alert sound'}
          aria-pressed={soundEnabled}
          onClick={onToggleSound}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200"
        >
          {soundEnabled ? (
            <Volume2 className="h-4 w-4 text-neutral-600" />
          ) : (
            <VolumeX className="h-4 w-4 text-neutral-400" />
          )}
        </button>
      )}
    </div>
  );
}
