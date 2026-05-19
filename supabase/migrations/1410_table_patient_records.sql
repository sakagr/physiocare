-- ============================================================
-- Table: patient_records
-- ============================================================
-- Depends on patients and users.


create table public.patient_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null,
  uploaded_by uuid null,
  record_type text not null,
  title text not null,
  file_url text not null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_records_organization_id_patient_id_fkey
    foreign key (organization_id, patient_id) references public.patients(organization_id, id) on delete cascade,
  constraint patient_records_organization_id_uploaded_by_fkey
    foreign key (organization_id, uploaded_by) references public.users(organization_id, id) on delete set null
);
