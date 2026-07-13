-- ============================================================
-- Remove ORG_ACCOUNTANT role
-- ============================================================
-- ORG_ACCOUNTANT is not part of the V1 product. It has never been granted
-- any capability in authorization.service.ts, so removal is pure deletion,
-- not a re-permissioning exercise. No production/local data is expected to
-- reference this role (pre-launch).
--
-- Postgres cannot drop a single value from an enum type in place, so this
-- follows the same recreate-the-type shape already used in
-- 20260711235700_user_auth_redesign.sql.
--
-- Unlike that earlier migration, several RLS policies added since then
-- (20260712220000_user_clinics_rls.sql, 20260714000000_clinical_rls_rewrite.sql)
-- reference public.roles.name directly inside a join (rather than going
-- through the current_user_role() function, which shields the column from
-- dependency tracking). Postgres records a hard dependency on the column for
-- any policy that references it inline, which blocks ALTER COLUMN ... TYPE.
-- Those policies are dropped here and recreated verbatim (unchanged) after
-- the enum is rebuilt.

-- ------------------------------------------------------------
-- Drop policies that depend on public.roles.name
-- ------------------------------------------------------------
drop policy if exists "user_clinics_select_policy" on "public"."user_clinics";
drop policy if exists "user_clinics_insert_policy" on "public"."user_clinics";
drop policy if exists "user_clinics_update_policy" on "public"."user_clinics";
drop policy if exists "user_clinics_delete_policy" on "public"."user_clinics";

drop policy if exists "patients_select_policy" on "public"."patients";
drop policy if exists "patients_update_policy" on "public"."patients";
drop policy if exists "patient_records_select_policy" on "public"."patient_records";
drop policy if exists "patient_records_update_policy" on "public"."patient_records";
drop policy if exists "appointments_select_policy" on "public"."appointments";
drop policy if exists "appointments_update_policy" on "public"."appointments";
drop policy if exists "appointment_status_logs_select_policy" on "public"."appointment_status_logs";
drop policy if exists "consultations_select_policy" on "public"."consultations";
drop policy if exists "consultations_update_policy" on "public"."consultations";
drop policy if exists "prescriptions_select_policy" on "public"."prescriptions";
drop policy if exists "prescriptions_update_policy" on "public"."prescriptions";

drop policy if exists "patient_records_storage_select_policy" on "storage"."objects";
drop policy if exists "patient_records_storage_insert_policy" on "storage"."objects";

-- ------------------------------------------------------------
-- Recreate the app_role enum without ORG_ACCOUNTANT
-- ------------------------------------------------------------
ALTER TABLE public.roles ALTER COLUMN name TYPE text;

DELETE FROM public.roles WHERE name = 'ORG_ACCOUNTANT';

DROP TYPE public.app_role;

CREATE TYPE public.app_role AS ENUM (
  'SUPER_ADMIN',
  'PLATFORM_SUPPORT',
  'PLATFORM_SALES',
  'PLATFORM_BILLING',
  'ORG_OWNER',
  'ORG_ADMIN',
  'ORG_PHYSIOTHERAPIST',
  'ORG_RECEPTIONIST'
);

ALTER TABLE public.roles ALTER COLUMN name TYPE public.app_role USING name::public.app_role;

-- ------------------------------------------------------------
-- Recreate the dropped policies verbatim (unchanged definitions)
-- ------------------------------------------------------------
create policy "user_clinics_select_policy"
on "public"."user_clinics"
for select
to authenticated
using (
  public.is_super_admin() OR
  (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
      and u.organization_id = user_clinics.organization_id
    )
  )
);

create policy "user_clinics_insert_policy"
on "public"."user_clinics"
for insert
to authenticated
with check (
  public.is_super_admin() OR
  (
    exists (
      select 1 from public.users u
      join public.roles r on u.role_id = r.id
      where u.id = auth.uid()
      and u.organization_id = user_clinics.organization_id
      and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
);

create policy "user_clinics_update_policy"
on "public"."user_clinics"
for update
to authenticated
using (
  public.is_super_admin() OR
  (
    exists (
      select 1 from public.users u
      join public.roles r on u.role_id = r.id
      where u.id = auth.uid()
      and u.organization_id = user_clinics.organization_id
      and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
)
with check (
  public.is_super_admin() OR
  (
    exists (
      select 1 from public.users u
      join public.roles r on u.role_id = r.id
      where u.id = auth.uid()
      and u.organization_id = user_clinics.organization_id
      and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
);

create policy "user_clinics_delete_policy"
on "public"."user_clinics"
for delete
to authenticated
using (
  public.is_super_admin() OR
  (
    exists (
      select 1 from public.users u
      join public.roles r on u.role_id = r.id
      where u.id = auth.uid()
      and u.organization_id = user_clinics.organization_id
      and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
);

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

create policy "patient_records_storage_select_policy"
on "storage"."objects"
as permissive
for select
to authenticated
using (
  bucket_id = 'patient-records'
  and (
    public.is_super_admin()
    or (
      exists (
        select 1 from public.users u
        join public.roles r on u.role_id = r.id
        where u.id = auth.uid()
          and u.organization_id::text = (storage.foldername(objects.name))[1]
          and r.name in ('ORG_OWNER', 'ORG_ADMIN')
      )
    )
    or exists (
      select 1 from public.appointments a
      where a.patient_id::text = (storage.foldername(objects.name))[2]
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
    or exists (
      select 1 from public.appointments a
      where a.patient_id::text = (storage.foldername(objects.name))[2]
        and a.physiotherapist_id = auth.uid()
    )
  )
);

create policy "patient_records_storage_insert_policy"
on "storage"."objects"
as permissive
for insert
to authenticated
with check (
  bucket_id = 'patient-records'
  and (
    public.is_super_admin()
    or (
      exists (
        select 1 from public.users u
        join public.roles r on u.role_id = r.id
        where u.id = auth.uid()
          and u.organization_id::text = (storage.foldername(objects.name))[1]
          and r.name in ('ORG_OWNER', 'ORG_ADMIN')
      )
    )
    or exists (
      select 1 from public.appointments a
      where a.patient_id::text = (storage.foldername(objects.name))[2]
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
    or exists (
      select 1 from public.appointments a
      where a.patient_id::text = (storage.foldername(objects.name))[2]
        and a.physiotherapist_id = auth.uid()
    )
  )
);
