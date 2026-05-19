-- ============================================================
-- Table: clinics
-- ============================================================
-- Tenant-owned clinic locations.


create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  clinic_name text not null,
  address text null,
  city text null,
  state text null,
  pincode text null,
  phone text null,
  email text null,
  gst_number text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint clinics_organization_id_id_key unique (organization_id, id),
  constraint clinics_organization_id_clinic_name_key unique (organization_id, clinic_name)
);
