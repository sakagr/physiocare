-- ============================================================
-- Patient package status becomes a derived view; cancellation
-- becomes an explicit decision
-- ============================================================
-- No deployed project and no patient_packages rows in supabase/seeds/ or
-- committed data exist -- this is a plain schema change, not a backfill.
-- See AGENTS.md -> Project Decisions -> "Patient Package Status as a
-- Derived View" for the full rationale.

-- ------------------------------------------------------------
-- Cancellation: an explicit decision, not an implied enum value
-- ------------------------------------------------------------
alter table public.patient_packages add column cancelled_at timestamptz null;
alter table public.patient_packages add column cancelled_by uuid null;
alter table public.patient_packages
  add constraint patient_packages_organization_id_cancelled_by_fkey
  foreign key (organization_id, cancelled_by) references public.users(organization_id, id) on delete set null;
create index patient_packages_cancelled_by_idx on public.patient_packages(cancelled_by);

-- ------------------------------------------------------------
-- Drop the stored status column entirely
-- ------------------------------------------------------------
alter table public.patient_packages drop column status;

-- ------------------------------------------------------------
-- Derived-status view. security_invoker = true is load-bearing: without it,
-- RLS on patient_packages would be evaluated as the view's owner rather than
-- the calling session, which -- given the owner role that applies migrations
-- plausibly has BYPASSRLS -- could silently expose every organization's rows
-- through the view regardless of the table's own policies.
--
-- `select pp.*` is expanded and frozen at view-creation time: a future
-- column added to patient_packages will NOT appear here until this view is
-- replaced (`create or replace view ...`) to pick it up. Whoever next adds a
-- column to patient_packages must also touch this view --
-- tests/integration/patient-packages.test.ts asserts the two column sets
-- stay in sync so this can't drift silently.
-- ------------------------------------------------------------
create view public.patient_packages_view
with (security_invoker = true)
as
select
  pp.*,
  (case
    when pp.cancelled_at is not null then 'cancelled'
    when pp.remaining_sessions = 0 then 'completed'
    when current_date > coalesce(pp.extended_validity_to, pp.expiry_date) then 'expired'
    else 'active'
  end)::public.package_status as status
from public.patient_packages pp;

grant select on public.patient_packages_view to authenticated;

-- ------------------------------------------------------------
-- Session-consumption RPCs: stop writing status (now derived, not stored).
-- CREATE OR REPLACE preserves the existing REVOKE/GRANT EXECUTE from
-- 20260716000100_package_session_consumption.sql -- not restated here.
-- ------------------------------------------------------------
create or replace function public.consume_package_session(
  p_organization_id uuid,
  p_patient_package_id uuid,
  p_appointment_id uuid,
  p_used_on date default current_date
) returns public.package_session_usage
language plpgsql
security definer
set search_path = public
as $$
declare
  v_package public.patient_packages;
  v_usage public.package_session_usage;
begin
  select * into v_package from public.patient_packages
    where id = p_patient_package_id and organization_id = p_organization_id
    for update;

  if not found then
    raise exception 'PATIENT_PACKAGE_NOT_FOUND';
  end if;

  if v_package.remaining_sessions <= 0 then
    raise exception 'PACKAGE_SESSIONS_EXHAUSTED';
  end if;

  insert into public.package_session_usage (organization_id, patient_package_id, appointment_id, used_on)
  values (p_organization_id, p_patient_package_id, p_appointment_id, p_used_on)
  returning * into v_usage;

  update public.patient_packages
  set remaining_sessions = remaining_sessions - 1,
      used_sessions = used_sessions + 1
  where id = p_patient_package_id;

  return v_usage;
exception
  when unique_violation then
    raise exception 'PACKAGE_SESSION_ALREADY_RECORDED';
end;
$$;

create or replace function public.reverse_package_session_usage(
  p_organization_id uuid,
  p_appointment_id uuid
) returns public.package_session_usage
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usage public.package_session_usage;
begin
  select * into v_usage from public.package_session_usage
    where appointment_id = p_appointment_id
      and organization_id = p_organization_id
      and deleted_at is null
    for update;

  if not found then
    return null;
  end if;

  update public.package_session_usage
  set deleted_at = now()
  where id = v_usage.id
  returning * into v_usage;

  update public.patient_packages
  set remaining_sessions = remaining_sessions + 1,
      used_sessions = used_sessions - 1
  where id = v_usage.patient_package_id;

  return v_usage;
end;
$$;
