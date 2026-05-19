-- ============================================================
-- Table: consultations
-- ============================================================
-- Depends on appointments, patients, and users.


create table public.consultations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  appointment_id uuid not null,
  patient_id uuid not null,
  physiotherapist_id uuid not null,
  symptoms text null,
  pain_areas jsonb not null default '[]'::jsonb,
  pain_scale integer null check (pain_scale between 0 and 10),
  diagnosis_notes text null,
  followup_notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consultations_organization_id_id_key unique (organization_id, id),
  constraint consultations_organization_id_appointment_id_key unique (organization_id, appointment_id),
  constraint consultations_organization_id_appointment_id_fkey
    foreign key (organization_id, appointment_id) references public.appointments(organization_id, id) on delete cascade,
  constraint consultations_organization_id_patient_id_fkey
    foreign key (organization_id, patient_id) references public.patients(organization_id, id) on delete restrict,
  constraint consultations_organization_id_physiotherapist_id_fkey
    foreign key (organization_id, physiotherapist_id) references public.users(organization_id, id) on delete restrict
);
