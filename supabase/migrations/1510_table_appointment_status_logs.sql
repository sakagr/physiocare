-- ============================================================
-- Table: appointment_status_logs
-- ============================================================
-- Depends on appointments and users.


create table public.appointment_status_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  appointment_id uuid not null,
  old_status public.appointment_status null,
  new_status public.appointment_status not null,
  changed_by uuid null,
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint appointment_status_logs_organization_id_appointment_id_fkey
    foreign key (organization_id, appointment_id) references public.appointments(organization_id, id) on delete cascade,
  constraint appointment_status_logs_organization_id_changed_by_fkey
    foreign key (organization_id, changed_by) references public.users(organization_id, id) on delete set null
);
