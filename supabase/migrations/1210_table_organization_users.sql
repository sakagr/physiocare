-- ============================================================
-- Table: organization_users
-- ============================================================
-- Maps users to organizations and organization roles.


create table public.organization_users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  organization_role public.app_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint organization_users_organization_id_user_id_key unique (organization_id, user_id)
);
