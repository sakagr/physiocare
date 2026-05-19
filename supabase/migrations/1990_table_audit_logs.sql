-- ============================================================
-- Table: audit_logs
-- ============================================================
-- Depends on users.


create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid null,
  action text not null,
  entity_name text not null,
  entity_id uuid not null,
  old_data jsonb null,
  new_data jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint audit_logs_organization_id_user_id_fkey
    foreign key (organization_id, user_id) references public.users(organization_id, id) on delete set null
);
