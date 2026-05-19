-- ============================================================
-- Roles
-- ============================================================
-- Depends on 002_enums.sql for public.app_role.


create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name public.app_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roles_name_key unique (name)
);

insert into public.roles (name) values
  ('SUPER_ADMIN'),
  ('ORG_ADMIN'),
  ('RECEPTIONIST'),
  ('PHYSIOTHERAPIST')
on conflict (name) do nothing;
