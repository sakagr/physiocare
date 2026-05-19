-- ============================================================
-- Table: patients
-- ============================================================
-- Tenant-owned patient master records.


create table public.patients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_code text not null,
  full_name text not null,
  gender public.patient_gender null,
  dob date null,
  phone text null,
  email text null,
  address text null,
  emergency_contact text null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint patients_organization_id_id_key unique (organization_id, id),
  constraint patients_organization_id_patient_code_key unique (organization_id, patient_code),
  constraint patients_organization_id_created_by_fkey
    foreign key (organization_id, created_by) references public.users(organization_id, id) on delete set null
);
