-- ============================================================
-- Table: user_attendance
-- ============================================================
-- Depends on users and clinics.


create table public.user_attendance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  clinic_id uuid not null,
  attendance_date date not null,
  check_in_time timestamptz not null,
  check_out_time timestamptz null,
  status public.attendance_status not null default 'present',
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint user_attendance_organization_id_user_id_fkey
    foreign key (organization_id, user_id) references public.users(organization_id, id) on delete cascade,
  constraint user_attendance_organization_id_clinic_id_fkey
    foreign key (organization_id, clinic_id) references public.clinics(organization_id, id) on delete restrict,
  constraint user_attendance_organization_id_user_id_attendance_date_key unique (organization_id, user_id, attendance_date),
  constraint user_attendance_time_check check (check_out_time is null or check_out_time >= check_in_time)
);
