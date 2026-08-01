-- ============================================================
-- Remove PLATFORM_SUPPORT / PLATFORM_SALES / PLATFORM_BILLING roles
-- ============================================================
-- These three roles are stale: never granted any capability beyond what
-- SUPER_ADMIN already carries, and not part of the V1 product. V1's role set
-- becomes exactly SUPER_ADMIN, ORG_OWNER, ORG_ADMIN, ORG_PHYSIOTHERAPIST,
-- ORG_RECEPTIONIST. No re-introduction path is kept anywhere -- a later need
-- is a later decision.
--
-- Postgres cannot drop a single value from an enum type in place, so this
-- follows the same recreate-the-type shape as
-- 20260714000200_remove_org_accountant_role.sql.
--
-- Unlike that migration, the dependent-policy list below was not copied from
-- the precedent or derived by grep -- both are unreliable once several
-- migrations have touched policies since. It was derived directly against
-- the live schema:
--
--   select distinct pol.polname, cls.relname, nsp.nspname
--   from pg_depend d
--   join pg_attribute a on a.attrelid = d.refobjid and a.attnum = d.refobjsubid
--   join pg_policy pol on pol.oid = d.objid
--   join pg_class cls on cls.oid = pol.polrelid
--   join pg_namespace nsp on nsp.oid = cls.relnamespace
--   where d.refobjid = 'public.roles'::regclass
--     and a.attname = 'name'
--     and d.classid = 'pg_policy'::regclass;
--
-- This is the authoritative set of policies with a hard dependency on
-- public.roles.name (i.e. that join public.roles inline rather than going
-- through current_user_role()/is_super_admin(), which shield the column from
-- dependency tracking) as of this migration. All 31 are dropped here and
-- recreated verbatim (unchanged definitions) after the enum is rebuilt --
-- this migration's job is role removal, not policy revision.

-- ------------------------------------------------------------
-- Precondition: no user may currently hold one of the roles being removed.
-- users.role_id references public.roles(id) on delete restrict
-- (1200_table_users.sql:10), so the DELETE below would otherwise fail with a
-- raw FK-violation error partway through. Fail fast with a clear message
-- naming the problem instead.
-- ------------------------------------------------------------
do $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.users u
  join public.roles r on u.role_id = r.id
  where r.name in ('PLATFORM_SUPPORT', 'PLATFORM_SALES', 'PLATFORM_BILLING');

  if v_count > 0 then
    raise exception 'Cannot remove PLATFORM_* roles: % user(s) still assigned to one of PLATFORM_SUPPORT/PLATFORM_SALES/PLATFORM_BILLING', v_count;
  end if;
end $$;

-- ------------------------------------------------------------
-- Drop policies that depend on public.roles.name
-- ------------------------------------------------------------
drop policy if exists "appointment_status_logs_select_policy" on "public"."appointment_status_logs";
drop policy if exists "appointments_select_policy" on "public"."appointments";
drop policy if exists "appointments_update_policy" on "public"."appointments";
drop policy if exists "audit_logs_select_policy" on "public"."audit_logs";
drop policy if exists "consultations_select_policy" on "public"."consultations";
drop policy if exists "consultations_update_policy" on "public"."consultations";
drop policy if exists "invoice_items_select_policy" on "public"."invoice_items";
drop policy if exists "invoice_items_update_policy" on "public"."invoice_items";
drop policy if exists "invoices_select_policy" on "public"."invoices";
drop policy if exists "invoices_update_policy" on "public"."invoices";
drop policy if exists "organizations_update_policy" on "public"."organizations";
drop policy if exists "package_session_usage_delete_policy" on "public"."package_session_usage";
drop policy if exists "package_session_usage_select_policy" on "public"."package_session_usage";
drop policy if exists "packages_update_policy" on "public"."packages";
drop policy if exists "patient_packages_update_policy" on "public"."patient_packages";
drop policy if exists "patient_records_select_policy" on "public"."patient_records";
drop policy if exists "patient_records_update_policy" on "public"."patient_records";
drop policy if exists "patients_update_policy" on "public"."patients";
drop policy if exists "payments_select_policy" on "public"."payments";
drop policy if exists "payments_update_policy" on "public"."payments";
drop policy if exists "prescriptions_select_policy" on "public"."prescriptions";
drop policy if exists "prescriptions_update_policy" on "public"."prescriptions";
drop policy if exists "user_attendance_select_policy" on "public"."user_attendance";
drop policy if exists "user_clinics_delete_policy" on "public"."user_clinics";
drop policy if exists "user_clinics_insert_policy" on "public"."user_clinics";
drop policy if exists "user_clinics_update_policy" on "public"."user_clinics";
drop policy if exists "user_compensations_insert_policy" on "public"."user_compensations";
drop policy if exists "user_compensations_select_policy" on "public"."user_compensations";
drop policy if exists "user_compensations_update_policy" on "public"."user_compensations";
drop policy if exists "patient_records_storage_insert_policy" on "storage"."objects";
drop policy if exists "patient_records_storage_select_policy" on "storage"."objects";

-- ------------------------------------------------------------
-- Recreate the app_role enum without PLATFORM_SUPPORT / PLATFORM_SALES / PLATFORM_BILLING
-- ------------------------------------------------------------
ALTER TABLE public.roles ALTER COLUMN name TYPE text;

DELETE FROM public.roles WHERE name IN ('PLATFORM_SUPPORT', 'PLATFORM_SALES', 'PLATFORM_BILLING');

DROP TYPE public.app_role;

CREATE TYPE public.app_role AS ENUM (
  'SUPER_ADMIN',
  'ORG_OWNER',
  'ORG_ADMIN',
  'ORG_PHYSIOTHERAPIST',
  'ORG_RECEPTIONIST'
);

ALTER TABLE public.roles ALTER COLUMN name TYPE public.app_role USING name::public.app_role;

-- ------------------------------------------------------------
-- Recreate the dropped policies verbatim (unchanged definitions)
-- ------------------------------------------------------------
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

create policy "audit_logs_select_policy"
on "public"."audit_logs"
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
        and u.organization_id = audit_logs.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN')
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

create policy "invoice_items_select_policy"
on "public"."invoice_items"
as permissive
for select
to authenticated
using (
  public.is_super_admin()
  OR exists (
    select 1 from public.invoices i
    where i.id = invoice_items.invoice_id
      and (
        (
          i.organization_id = public.current_organization_id()
          and exists (
            select 1 from public.users u
            join public.roles r on u.role_id = r.id
            where u.id = auth.uid()
              and u.organization_id = i.organization_id
              and r.name in ('ORG_OWNER', 'ORG_ADMIN')
          )
        )
        OR (
          i.clinic_id in (
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
          where a.id = i.appointment_id
            and a.physiotherapist_id = auth.uid()
        )
      )
  )
);

create policy "invoice_items_update_policy"
on "public"."invoice_items"
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
        and u.organization_id = invoice_items.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN', 'ORG_RECEPTIONIST')
    )
  )
)
with check (
  public.is_super_admin()
  OR organization_id = public.current_organization_id()
);

create policy "invoices_select_policy"
on "public"."invoices"
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
        and u.organization_id = invoices.organization_id
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
  OR exists (
    select 1 from public.appointments a
    where a.id = invoices.appointment_id
      and a.physiotherapist_id = auth.uid()
  )
);

create policy "invoices_update_policy"
on "public"."invoices"
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
        and u.organization_id = invoices.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN', 'ORG_RECEPTIONIST')
    )
  )
)
with check (
  public.is_super_admin()
  OR organization_id = public.current_organization_id()
);

create policy "organizations_update_policy"
on "public"."organizations"
as permissive
for update
to authenticated
using (
  public.is_super_admin()
  OR (
    id = public.current_organization_id()
    AND exists (
      select 1 from public.users u
      join public.roles r on u.role_id = r.id
      where u.id = auth.uid()
        and u.organization_id = organizations.id
        and r.name = 'ORG_OWNER'
    )
  )
)
with check (
  public.is_super_admin()
  OR id = public.current_organization_id()
);

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

create policy "packages_update_policy"
on "public"."packages"
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
        and u.organization_id = packages.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
)
with check (
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

create policy "payments_select_policy"
on "public"."payments"
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
        and u.organization_id = payments.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
  OR exists (
    select 1 from public.invoices i
    where i.id = payments.invoice_id
      and i.clinic_id in (
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
    select 1 from public.invoices i
    join public.appointments a on a.id = i.appointment_id
    where i.id = payments.invoice_id
      and a.physiotherapist_id = auth.uid()
  )
);

create policy "payments_update_policy"
on "public"."payments"
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
        and u.organization_id = payments.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
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

create policy "user_attendance_select_policy"
on "public"."user_attendance"
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
        and u.organization_id = user_attendance.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
  OR user_id = auth.uid()
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

create policy "user_compensations_select_policy"
on "public"."user_compensations"
as permissive
for select
to authenticated
using (
  public.is_super_admin()
  OR user_id = auth.uid()
  OR (
    organization_id = public.current_organization_id()
    AND exists (
      select 1 from public.users u
      join public.roles r on u.role_id = r.id
      where u.id = auth.uid()
        and u.organization_id = user_compensations.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
);

create policy "user_compensations_insert_policy"
on "public"."user_compensations"
as permissive
for insert
to authenticated
with check (
  public.is_super_admin()
  OR (
    organization_id = public.current_organization_id()
    AND exists (
      select 1 from public.users u
      join public.roles r on u.role_id = r.id
      where u.id = auth.uid()
        and u.organization_id = user_compensations.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
);

create policy "user_compensations_update_policy"
on "public"."user_compensations"
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
        and u.organization_id = user_compensations.organization_id
        and r.name in ('ORG_OWNER', 'ORG_ADMIN')
    )
  )
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
