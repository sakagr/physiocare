-- ============================================================
-- Table: patient_packages
-- ============================================================
-- Depends on patients and packages.


create table public.patient_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null,
  package_id uuid not null,
  purchased_on date not null default current_date,
  expiry_date date not null,
  extended_validity_to date null,
  total_sessions integer not null check (total_sessions > 0),
  used_sessions integer not null default 0 check (used_sessions >= 0),
  remaining_sessions integer not null check (remaining_sessions >= 0),
  status public.package_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_packages_organization_id_id_key unique (organization_id, id),
  constraint patient_packages_organization_id_patient_id_fkey
    foreign key (organization_id, patient_id) references public.patients(organization_id, id) on delete restrict,
  constraint patient_packages_organization_id_package_id_fkey
    foreign key (organization_id, package_id) references public.packages(organization_id, id) on delete restrict,
  constraint patient_packages_session_balance_check check (used_sessions + remaining_sessions = total_sessions),
  constraint patient_packages_dates_check check (
    expiry_date >= purchased_on
    and (extended_validity_to is null or extended_validity_to >= expiry_date)
  )
);
