-- ============================================================
-- Table: package_session_usage
-- ============================================================
-- Depends on patient packages and appointments.


create table public.package_session_usage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_package_id uuid not null,
  appointment_id uuid not null,
  used_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint package_session_usage_organization_id_patient_package_id_fkey
    foreign key (organization_id, patient_package_id) references public.patient_packages(organization_id, id) on delete cascade,
  constraint package_session_usage_organization_id_appointment_id_fkey
    foreign key (organization_id, appointment_id) references public.appointments(organization_id, id) on delete restrict,
  constraint package_session_usage_appointment_id_key unique (appointment_id)
);
