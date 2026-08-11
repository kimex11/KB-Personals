import { createClient } from './supabase/client';

export type AuditAction = 'create' | 'update' | 'delete' | 'upload' | 'link' | 'unlink' | 'skip' | 'archive' | 'unarchive' | 'merge';

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorEmail: string;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  entityLabel: string;
  beforeValue: Record<string, unknown> | null;
  afterValue: Record<string, unknown> | null;
  createdAt: string;
}

interface AuditLogRow {
  id: string;
  actor_id: string | null;
  actor_email: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  created_at: string;
}

function rowToEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorEmail: row.actor_email,
    action: row.action as AuditAction,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityLabel: row.entity_label,
    beforeValue: row.before_value,
    afterValue: row.after_value,
    createdAt: row.created_at,
  };
}

export interface LogActivityInput {
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  entityLabel: string;
  beforeValue?: Record<string, unknown> | null;
  afterValue?: Record<string, unknown> | null;
}

export async function logActivity(input: LogActivityInput): Promise<void> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const actor = userData.user;

  const { error } = await supabase.from('audit_log').insert({
    actor_id: actor?.id ?? null,
    actor_email: actor?.email ?? 'unknown',
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    entity_label: input.entityLabel,
    before_value: input.beforeValue ?? null,
    after_value: input.afterValue ?? null,
  });
  if (error) throw error;
}

export async function listAuditLog(): Promise<AuditLogEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as AuditLogRow[]).map(rowToEntry);
}
