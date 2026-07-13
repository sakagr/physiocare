-- ============================================================
-- Patient package lifecycle + org-wide visibility
-- ============================================================
-- D2: patient_packages gains deleted_at for administrative-correction soft
-- delete (business lifecycle continues to be driven by `status`), plus
-- package_name/package_price snapshot columns so a later edit or deletion of
-- the catalog package never changes a historical purchase record.
--
-- D3: now that packages are organization-scoped (not clinic-scoped), patient
-- package visibility becomes organization-wide too, dropping the old
-- appointment-clinic-based receptionist branch entirely (same treatment the
-- `patients` policy got in 20260714000000_clinical_rls_rewrite.sql).

alter table public.patient_packages add column deleted_at timestamptz null;
alter table public.patient_packages add column package_name text not null;
alter table public.patient_packages add column package_price numeric(12,2) not null;

-- ------------------------------------------------------------
-- patient_packages RLS
-- ------------------------------------------------------------
drop policy if exists "patient_packages_select_policy" on "public"."patient_packages";
drop policy if exists "patient_packages_update_policy" on "public"."patient_packages";

create policy "patient_packages_select_policy"
on "public"."patient_packages"
as permissive
for select
to authenticated
using (
  public.is_super_admin()
  OR organization_id = public.current_organization_id()
);

create policy "patient_packages_update_policy"
on "public"."patient_packages"
as permissive
for update
to authenticated
using (
  public.is_super_admin()
  OR (
    organization_id = public.current_organization_id()
    AND exists (
      select 1 from public.users u
      join public.roles r on u.role_id = r.id
      where u.id = auth.uid()
        and u.organization_id = patient_packages.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN', 'ORG_RECEPTIONIST')
    )
  )
)
with check (
  public.is_super_admin()
  OR organization_id = public.current_organization_id()
);

-- ------------------------------------------------------------
-- package_session_usage: DB-layer role-name consistency fix only (same
-- reasoning as appointment_status_logs in the 5.1 rewrite -- this table's
-- scoping model and write path are untouched, owned by Phase 8, but it
-- shouldn't be left with dead role-name RLS).
-- ------------------------------------------------------------
drop policy if exists "package_session_usage_select_policy" on "public"."package_session_usage";

create policy "package_session_usage_select_policy"
on "public"."package_session_usage"
as permissive
for select
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
  OR exists (
    select 1 from public.appointments a
    where a.id = package_session_usage.appointment_id
      and a.clinic_id in (
        select uc.clinic_id from public.user_clinics uc
        where uc.user_id = auth.uid() and uc.deleted_at is null
      )
      and exists (
        select 1 from public.users u
        join public.roles r on u.role_id = r.id
        where u.id = auth.uid() and r.name = 'ORG_RECEPTIONIST'
      )
  )
  OR exists (
    select 1 from public.appointments a
    where a.id = package_session_usage.appointment_id
      and a.physiotherapist_id = auth.uid()
  )
);
