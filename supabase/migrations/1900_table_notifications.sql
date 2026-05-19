-- ============================================================
-- Table: notifications
-- ============================================================
-- Depends on users, patients, and appointments.


create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient_type public.recipient_type not null,
  user_id uuid null,
  patient_id uuid null,
  appointment_id uuid null,
  notification_type text not null,
  channel public.notification_channel not null,
  message text not null,
  status public.notification_status not null default 'pending',
  sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint notifications_organization_id_user_id_fkey
    foreign key (organization_id, user_id) references public.users(organization_id, id) on delete cascade,
  constraint notifications_organization_id_patient_id_fkey
    foreign key (organization_id, patient_id) references public.patients(organization_id, id) on delete cascade,
  constraint notifications_organization_id_appointment_id_fkey
    foreign key (organization_id, appointment_id) references public.appointments(organization_id, id) on delete set null,
  constraint notifications_recipient_check check (
    (recipient_type = 'user' and user_id is not null and patient_id is null)
    or (recipient_type = 'patient' and patient_id is not null and user_id is null)
  )
);
