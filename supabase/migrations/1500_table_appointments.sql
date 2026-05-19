-- ============================================================
-- Table: appointments
-- ============================================================
-- Depends on patients, clinics, and physiotherapist users.


create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null,
  clinic_id uuid not null,
  physiotherapist_id uuid not null,
  appointment_time timestamptz not null,
  status public.appointment_status not null default 'scheduled',
  appointment_type public.appointment_type not null default 'therapy_session',
  notes text null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint appointments_organization_id_id_key unique (organization_id, id),
  constraint appointments_organization_id_patient_id_fkey
    foreign key (organization_id, patient_id) references public.patients(organization_id, id) on delete restrict,
  constraint appointments_organization_id_clinic_id_fkey
    foreign key (organization_id, clinic_id) references public.clinics(organization_id, id) on delete restrict,
  constraint appointments_organization_id_physiotherapist_id_fkey
    foreign key (organization_id, physiotherapist_id) references public.users(organization_id, id) on delete restrict,
  constraint appointments_organization_id_created_by_fkey
    foreign key (organization_id, created_by) references public.users(organization_id, id) on delete set null
);
