-- ============================================================
-- Table: users
-- ============================================================
-- Depends on auth.users, public.organizations, and public.roles. Adds the circular organizations.created_by FK after users exists.


create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid null references public.organizations(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  full_name text not null,
  email text not null,
  phone text null,
  is_active boolean not null default true,
  commission_type public.commission_type not null default 'none',
  commission_value numeric(12,2) not null default 0 check (commission_value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint users_email_key unique (email),
  constraint users_organization_id_id_key unique (organization_id, id),
  constraint users_commission_check check (
    (commission_type = 'none' and commission_value = 0)
    or (commission_type = 'fixed' and commission_value >= 0)
    or (commission_type = 'percentage' and commission_value between 0 and 100)
  )
);

alter table public.organizations
  add constraint organizations_created_by_fkey
  foreign key (created_by) references public.users(id) on delete set null;
