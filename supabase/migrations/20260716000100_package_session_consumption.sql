-- ============================================================
-- Package Session Consumption Logic (Phase 8)
-- ============================================================
-- D: package_session_usage_appointment_id_key was a plain unique constraint,
-- not scoped to deleted_at is null. The approved correction workflow
-- (soft-delete the wrong row, then record a fresh consumption for the same
-- appointment) would fail on the second insert under the plain constraint --
-- fixed here to follow this schema's own Partial Unique Index Convention.

alter table public.package_session_usage drop constraint package_session_usage_appointment_id_key;
create unique index package_session_usage_active_appointment_key
  on public.package_session_usage (appointment_id) where (deleted_at is null);

-- ------------------------------------------------------------
-- RLS: package_session_usage becomes correction-via-soft-delete, matching
-- the appointment_status_logs immutable-log shape for update, but (unlike
-- that pure audit log) allowing admin-initiated soft-delete for corrections.
-- ------------------------------------------------------------
drop policy if exists "package_session_usage_update_policy" on "public"."package_session_usage";
drop policy if exists "package_session_usage_delete_policy" on "public"."package_session_usage";

create policy "package_session_usage_update_policy"
on "public"."package_session_usage"
as permissive
for update
to authenticated
using (false);

create policy "package_session_usage_delete_policy"
on "public"."package_session_usage"
as permissive
for delete
to authenticated
using (
  public.is_super_admin()
  OR (
    organization_id = public.current_organization_id()
    AND exists (
      select 1 from public.users u
      join public.roles r on u.role_id = r.id
      where u.id = auth.uid()
        and u.organization_id = package_session_usage.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
);

-- ------------------------------------------------------------
-- Atomic consumption / reversal functions (see AGENTS.md "Database
-- Functions for Atomic Operations"). security definer, not invoker: the
-- physiotherapist completing their own appointment is a legitimate caller
-- of consumption (canAccessAppointment already authorizes them for the
-- appointment), but patient_packages_update_policy deliberately excludes
-- ORG_PHYSIOTHERAPIST from general patient-package edits. Widening that
-- table-level RLS policy would grant physiotherapists free-form UPDATE on
-- patient_packages (extended_validity_to, status, etc. via raw table
-- access), which is a strictly bigger hole than a narrow, pre-validated
-- function that only ever moves session counters by exactly one and only
-- ever touches the row identified by (p_organization_id, p_patient_package_id).
-- The organization_id parameter -- always the caller's own resolved
-- organization_id from the service layer, never client input -- is what
-- keeps this scoped; the composite FK from package_session_usage to
-- appointments(organization_id, id) additionally guarantees the
-- appointment itself belongs to that same organization. Row-locked
-- (`for update`) to close the race window a plain two-step client write
-- can't close.
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
      used_sessions = used_sessions + 1,
      status = case when remaining_sessions - 1 = 0 then 'completed' else status end
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
      used_sessions = used_sessions - 1,
      status = case when status = 'completed' then 'active' else status end
  where id = v_usage.patient_package_id;

  return v_usage;
end;
$$;

-- security definer functions default to PUBLIC-executable; lock these down
-- to authenticated only, since anon must never be able to move session
-- balances.
revoke execute on function public.consume_package_session(uuid, uuid, uuid, date) from public;
revoke execute on function public.reverse_package_session_usage(uuid, uuid) from public;
grant execute on function public.consume_package_session(uuid, uuid, uuid, date) to authenticated;
grant execute on function public.reverse_package_session_usage(uuid, uuid) to authenticated;
