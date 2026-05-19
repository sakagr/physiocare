-- ============================================================
-- Table: user_clinics
-- ============================================================
-- Depends on users and clinics composite tenant keys.


create table public.user_clinics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  clinic_id uuid not null,
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint user_clinics_organization_id_user_id_fkey
    foreign key (organization_id, user_id) references public.users(organization_id, id) on delete cascade,
  constraint user_clinics_organization_id_clinic_id_fkey
    foreign key (organization_id, clinic_id) references public.clinics(organization_id, id) on delete cascade,
  constraint user_clinics_user_id_clinic_id_key unique (user_id, clinic_id)
);
