import { createClient } from './supabase/client';

interface NotificationLogRow {
  entity_type: string;
  entity_id: string;
  state_key: string;
}

export async function listSentStateKeys(): Promise<Set<string>> {
  const supabase = createClient();
  const { data, error } = await supabase.from('notification_log').select('entity_type, entity_id, state_key');
  if (error || !data) return new Set();
  return new Set((data as NotificationLogRow[]).map((row) => `${row.entity_type}:${row.entity_id}:${row.state_key}`));
}
