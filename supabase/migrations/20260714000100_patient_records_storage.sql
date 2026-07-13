-- ============================================================
-- Storage: patient-records bucket
-- ============================================================
-- First use of Supabase Storage in the project. Private bucket — objects are
-- never served via a permanent public URL. patient_records.file_url stores
-- the object path only; the application generates a short-lived signed URL
-- on read. Object paths are always server-computed
-- (patient-records/{organization_id}/{patient_id}/{uuid}-{filename}), never
-- accepted from the client, so the path segments used below for RLS scoping
-- are trustworthy.
--
-- The application uploads via the service-role (admin) client, which bypasses
-- RLS entirely — these policies are a defense-in-depth backstop, mirroring
-- the patient_records table RLS in 20260714000000_clinical_rls_rewrite.sql.
--
-- Note: storage.objects.name is always referenced as "objects.name" (not the
-- bare "name") because several branches below join public.roles, which also
-- has a "name" column (app_role) — an unqualified reference resolves to the
-- nearest joined column, not the policy's own row, and breaks
-- storage.foldername(name).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'patient-records',
  'patient-records',
  false,
  20971520, -- 20 MiB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

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

create policy "patient_records_storage_update_policy"
on "storage"."objects"
as permissive
for update
to authenticated
using (bucket_id = 'patient-records' and public.is_super_admin())
with check (bucket_id = 'patient-records' and public.is_super_admin());

create policy "patient_records_storage_delete_policy"
on "storage"."objects"
as permissive
for delete
to authenticated
using (bucket_id = 'patient-records' and public.is_super_admin());
