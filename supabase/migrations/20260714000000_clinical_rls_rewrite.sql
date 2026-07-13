-- ============================================================
-- RLS rewrite: patients, patient_records, appointments,
-- appointment_status_logs, consultations, prescriptions
-- ============================================================
-- The policies created in 20260519093922_add_rls_policies.sql for these six
-- tables predate the role-model redesign in 20260711235700_user_auth_redesign.sql.
-- They compare public.current_user_role() against role names that no longer
-- exist ('RECEPTIONIST', 'PHYSIOTHERAPIST') or that changed meaning ('ORG_ADMIN'
-- used to be the org owner; a new, lower-privileged ORG_ADMIN exists now), and
-- ORG_OWNER has no access path in any of them. This migration ports them to the
-- role-join pattern established in 20260712220000_user_clinics_rls.sql.
--
-- Only SELECT and UPDATE policies reference role names on these tables; their
-- INSERT/DELETE policies are already org-scope-only or is_super_admin()-only
-- and are left untouched.
--
-- Business rule changes intentionally bundled with this fix:
--   - patients: visibility becomes organization-wide for any active org member
--     (patients are org-owned entities, not clinic-scoped); ORG_RECEPTIONIST
--     joins ORG_OWNER/ORG_ADMIN for write access, the stale physiotherapist-via-
--     appointment SELECT/UPDATE branch is dropped (write access to demographics
--     is administrative/front-desk only).
--   - user_clinics membership checks now also require deleted_at is null,
--     matching getAccessibleClinicIds() in authorization.service.ts (the
--     original 2026-05-19 policies never filtered this).

-- ------------------------------------------------------------
-- patients
-- ------------------------------------------------------------
drop policy if exists "patients_select_policy" on "public"."patients";
drop policy if exists "patients_update_policy" on "public"."patients";

create policy "patients_select_policy"
on "public"."patients"
as permissive
for select
to authenticated
using (
  public.is_super_admin()
  OR organization_id = public.current_organization_id()
);

create policy "patients_update_policy"
on "public"."patients"
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
        and u.organization_id = patients.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN', 'ORG_RECEPTIONIST')
    )
  )
)
with check (
  public.is_super_admin()
  OR organization_id = public.current_organization_id()
);

-- ------------------------------------------------------------
-- patient_records
-- ------------------------------------------------------------
drop policy if exists "patient_records_select_policy" on "public"."patient_records";
drop policy if exists "patient_records_update_policy" on "public"."patient_records";

create policy "patient_records_select_policy"
on "public"."patient_records"
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
        and u.organization_id = patient_records.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
  OR exists (
    select 1 from public.appointments a
    where a.patient_id = patient_records.patient_id
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
    where a.patient_id = patient_records.patient_id
      and a.physiotherapist_id = auth.uid()
  )
);

create policy "patient_records_update_policy"
on "public"."patient_records"
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
        and u.organization_id = patient_records.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
  OR exists (
    select 1 from public.appointments a
    where a.patient_id = patient_records.patient_id
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
    where a.patient_id = patient_records.patient_id
      and a.physiotherapist_id = auth.uid()
  )
)
with check (
  public.is_super_admin()
  OR organization_id = public.current_organization_id()
);

-- ------------------------------------------------------------
-- appointments
-- ------------------------------------------------------------
drop policy if exists "appointments_select_policy" on "public"."appointments";
drop policy if exists "appointments_update_policy" on "public"."appointments";

create policy "appointments_select_policy"
on "public"."appointments"
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
        and u.organization_id = appointments.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
  OR (
    clinic_id in (
      select uc.clinic_id from public.user_clinics uc
      where uc.user_id = auth.uid() and uc.deleted_at is null
    )
    AND exists (
      select 1 from public.users u
      join public.roles r on u.role_id = r.id
      where u.id = auth.uid() and r.name = 'ORG_RECEPTIONIST'
    )
  )
  OR physiotherapist_id = auth.uid()
);

create policy "appointments_update_policy"
on "public"."appointments"
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
        and u.organization_id = appointments.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
  OR (
    clinic_id in (
      select uc.clinic_id from public.user_clinics uc
      where uc.user_id = auth.uid() and uc.deleted_at is null
    )
    AND exists (
      select 1 from public.users u
      join public.roles r on u.role_id = r.id
      where u.id = auth.uid() and r.name = 'ORG_RECEPTIONIST'
    )
  )
  OR physiotherapist_id = auth.uid()
)
with check (
  public.is_super_admin()
  OR organization_id = public.current_organization_id()
);

-- ------------------------------------------------------------
-- appointment_status_logs (select only — insert/update/delete unchanged)
-- ------------------------------------------------------------
drop policy if exists "appointment_status_logs_select_policy" on "public"."appointment_status_logs";

create policy "appointment_status_logs_select_policy"
on "public"."appointment_status_logs"
as permissive
for select
to authenticated
using (
  public.is_super_admin()
  OR exists (
    select 1 from public.appointments a
    where a.id = appointment_status_logs.appointment_id
      and (
        (
          a.organization_id = public.current_organization_id()
          and exists (
            select 1 from public.users u
            join public.roles r on u.role_id = r.id
            where u.id = auth.uid()
              and u.organization_id = a.organization_id
              and r.name in ('ORG_OWNER', 'ORG_ADMIN')
          )
        )
        OR (
          a.clinic_id in (
            select uc.clinic_id from public.user_clinics uc
            where uc.user_id = auth.uid() and uc.deleted_at is null
          )
          and exists (
            select 1 from public.users u
            join public.roles r on u.role_id = r.id
            where u.id = auth.uid() and r.name = 'ORG_RECEPTIONIST'
          )
        )
        OR a.physiotherapist_id = auth.uid()
      )
  )
);

-- ------------------------------------------------------------
-- consultations
-- ------------------------------------------------------------
drop policy if exists "consultations_select_policy" on "public"."consultations";
drop policy if exists "consultations_update_policy" on "public"."consultations";

create policy "consultations_select_policy"
on "public"."consultations"
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
        and u.organization_id = consultations.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
  OR exists (
    select 1 from public.appointments a
    where a.id = consultations.appointment_id
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
  OR physiotherapist_id = auth.uid()
);

create policy "consultations_update_policy"
on "public"."consultations"
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
        and u.organization_id = consultations.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
  OR physiotherapist_id = auth.uid()
)
with check (
  public.is_super_admin()
  OR organization_id = public.current_organization_id()
);

-- ------------------------------------------------------------
-- prescriptions
-- ------------------------------------------------------------
drop policy if exists "prescriptions_select_policy" on "public"."prescriptions";
drop policy if exists "prescriptions_update_policy" on "public"."prescriptions";

create policy "prescriptions_select_policy"
on "public"."prescriptions"
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
        and u.organization_id = prescriptions.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
  OR exists (
    select 1 from public.consultations c
    join public.appointments a on a.id = c.appointment_id
    where c.id = prescriptions.consultation_id
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
  OR physiotherapist_id = auth.uid()
);

create policy "prescriptions_update_policy"
on "public"."prescriptions"
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
        and u.organization_id = prescriptions.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
  OR physiotherapist_id = auth.uid()
)
with check (
  public.is_super_admin()
  OR organization_id = public.current_organization_id()
);
