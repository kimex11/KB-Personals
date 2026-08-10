'use client';

import { Bell, BellOff, Volume2, VolumeX } from 'lucide-react';
import type { NotificationPriority } from '@/lib/notification-priority';

export type NotificationPermissionState = NotificationPermission | 'unsupported';

interface NotificationSettingsProps {
  permission: NotificationPermissionState;
  onRequestPermission: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  onQuietHoursChange: (start: string | null, end: string | null) => void;
  enabledPriorities: readonly NotificationPriority[];
  onTogglePriority: (priority: NotificationPriority) => void;
}

const STATUS_TEXT: Record<NotificationPermissionState, string> = {
  granted: 'Enabled — you will be alerted even when the app is closed',
  denied: 'Blocked — re-enable notifications in your browser or device settings',
  default: 'Get notified about overdue bills, due dates, and reminders',
  unsupported: 'Not supported on this browser or device',
};

const PRIORITY_LABELS: Record<NotificationPriority, string> = {
  critical: 'Overdue bills',
  urgent: 'Bills due soon',
  reminder: 'Reminders',
};

export function NotificationSettings({
  permission,
  onRequestPermission,
  soundEnabled,
  onToggleSound,
  quietHoursStart,
  quietHoursEnd,
  onQuietHoursChange,
  enabledPriorities,
  onTogglePriority,
}: NotificationSettingsProps) {
  return (
    <div data-testid="notification-settings" className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-2">
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

      {permission === 'granted' && (
        <>
          <div className="flex min-h-11 items-center gap-2 text-xs text-neutral-600">
            <label className="flex items-center gap-1">
              Quiet hours
              <input
                type="time"
                data-testid="quiet-hours-start"
                value={quietHoursStart ?? ''}
                onChange={(e) => onQuietHoursChange(e.target.value || null, quietHoursEnd)}
                className="rounded border border-neutral-200 px-1 py-0.5"
              />
            </label>
            <span>to</span>
            <input
              type="time"
              data-testid="quiet-hours-end"
              value={quietHoursEnd ?? ''}
              onChange={(e) => onQuietHoursChange(quietHoursStart, e.target.value || null)}
              className="rounded border border-neutral-200 px-1 py-0.5"
            />
          </div>
          <div className="flex flex-col gap-1">
            {(Object.keys(PRIORITY_LABELS) as NotificationPriority[]).map((priority) => (
              <label key={priority} className="flex min-h-11 items-center gap-2 text-xs text-neutral-600">
                <input
                  type="checkbox"
                  data-testid={`priority-toggle-${priority}`}
                  checked={enabledPriorities.includes(priority)}
                  onChange={() => onTogglePriority(priority)}
                />
                {PRIORITY_LABELS[priority]}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
