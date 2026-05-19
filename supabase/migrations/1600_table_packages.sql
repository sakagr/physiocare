-- ============================================================
-- Table: packages
-- ============================================================
-- Depends on clinics.


create table public.packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  clinic_id uuid not null,
  package_name text not null,
  total_sessions integer not null check (total_sessions > 0),
  package_price numeric(12,2) not null check (package_price >= 0),
  validity_days integer not null check (validity_days > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint packages_organization_id_id_key unique (organization_id, id),
  constraint packages_organization_id_clinic_id_fkey
    foreign key (organization_id, clinic_id) references public.clinics(organization_id, id) on delete restrict,
  constraint packages_organization_id_clinic_id_package_name_key unique (organization_id, clinic_id, package_name)
);
