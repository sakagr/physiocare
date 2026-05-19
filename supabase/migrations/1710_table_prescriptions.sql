-- ============================================================
-- Table: prescriptions
-- ============================================================
-- Depends on consultations, patients, and users.


create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  consultation_id uuid not null,
  patient_id uuid not null,
  physiotherapist_id uuid not null,
  advice text null,
  followup_date date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prescriptions_organization_id_consultation_id_fkey
    foreign key (organization_id, consultation_id) references public.consultations(organization_id, id) on delete cascade,
  constraint prescriptions_organization_id_patient_id_fkey
    foreign key (organization_id, patient_id) references public.patients(organization_id, id) on delete restrict,
  constraint prescriptions_organization_id_physiotherapist_id_fkey
    foreign key (organization_id, physiotherapist_id) references public.users(organization_id, id) on delete restrict
);
