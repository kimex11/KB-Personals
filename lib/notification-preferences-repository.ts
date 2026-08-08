import { createClient } from './supabase/client';
import type { NotificationPriority } from './notification-priority';

export interface NotificationPreferences {
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  soundEnabled: boolean;
  enabledPriorities: NotificationPriority[];
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  quietHoursStart: null,
  quietHoursEnd: null,
  soundEnabled: true,
  enabledPriorities: ['critical', 'urgent', 'reminder'],
};

interface PreferencesRow {
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  sound_enabled: boolean;
  enabled_priorities: string[];
}

export async function getPreferences(): Promise<NotificationPreferences> {
  const supabase = createClient();
  const { data, error } = await supabase.from('notification_preferences').select('*').maybeSingle();
  if (error || !data) return DEFAULT_PREFERENCES;

  const row = data as PreferencesRow;
  return {
    quietHoursStart: row.quiet_hours_start,
    quietHoursEnd: row.quiet_hours_end,
    soundEnabled: row.sound_enabled,
    enabledPriorities: row.enabled_priorities as NotificationPriority[],
  };
}

export async function upsertPreferences(input: NotificationPreferences): Promise<void> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  await supabase.from('notification_preferences').upsert({
    user_id: userData.user.id,
    quiet_hours_start: input.quietHoursStart,
    quiet_hours_end: input.quietHoursEnd,
    sound_enabled: input.soundEnabled,
    enabled_priorities: input.enabledPriorities,
  });
}
