create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  actor_email text not null,
  action text not null check (action in ('create', 'update', 'delete', 'upload', 'link', 'unlink', 'skip', 'archive', 'unarchive', 'merge')),
  entity_type text not null,
  entity_id uuid,
  entity_label text not null,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

create policy "Authenticated users can view audit log"
  on public.audit_log for select to authenticated using (true);
create policy "Authenticated users can insert audit log entries"
  on public.audit_log for insert to authenticated with check (auth.uid() = actor_id);

create index audit_log_created_at_idx on public.audit_log(created_at desc);
create index audit_log_entity_type_idx on public.audit_log(entity_type);
create index audit_log_actor_id_idx on public.audit_log(actor_id);
