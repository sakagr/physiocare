-- Widen patient record visibility to the full front-desk tier.
--
-- ORG_RECEPTIONIST was scoped to patients with an appointment at a clinic the
-- receptionist is assigned to. That made UX.md Flow 4 impossible for its own
-- primary actor: Reception creates the patient and attaches the first scans
-- before any appointment exists, then could not read back what it had just
-- uploaded.
--
-- The predicate change in authorization.service.ts is necessary but not
-- sufficient. listPatientRecords reads through the caller's session-scoped
-- client, so a widened predicate against an unchanged policy returns zero rows
-- rather than a refusal -- the same failure mode ADR-0011 recorded for
-- user_compensations, in the opposite direction. The policy change is part of
-- the fix, not a follow-up.
--
-- The ORG_PHYSIOTHERAPIST branch is carried through unchanged in every policy
-- below: a physiotherapist still sees records only for patients they have an
-- appointment with. That is a clinical boundary, not an oversight.
--
-- patient_records_insert_policy is untouched -- it never carried the
-- appointment-scoped clause and is already org-wide permissive.

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
        and r.name in ('ORG_OWNER', 'ORG_ADMIN', 'ORG_RECEPTIONIST')
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
        and r.name in ('ORG_OWNER', 'ORG_ADMIN', 'ORG_RECEPTIONIST')
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

-- The two storage.objects policies mirror the table's receptionist scoping
-- against the object path. They are not in the app's request path -- uploads
-- and signed-URL creation both go through the admin client, which bypasses
-- storage RLS -- so widening them changes no behaviour today. They are widened
-- anyway because they are the backstop for direct object access, and leaving
-- them narrower would leave a policy contradicting the boundary this migration
-- establishes.

drop policy if exists "patient_records_storage_select_policy" on "storage"."objects";
drop policy if exists "patient_records_storage_insert_policy" on "storage"."objects";

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
          and r.name in ('ORG_OWNER', 'ORG_ADMIN', 'ORG_RECEPTIONIST')
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
          and r.name in ('ORG_OWNER', 'ORG_ADMIN', 'ORG_RECEPTIONIST')
      )
    )
    or exists (
      select 1 from public.appointments a
      where a.patient_id::text = (storage.foldername(objects.name))[2]
        and a.physiotherapist_id = auth.uid()
    )
  )
);
