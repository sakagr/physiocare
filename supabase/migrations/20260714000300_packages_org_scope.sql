-- ============================================================
-- Packages become organization-scoped, not clinic-scoped
-- ============================================================
-- Small clinics need pricing/session-count/validity exceptions per patient,
-- which a clinic-level catalog can't express. A "custom" package is just a
-- regular package row created for a specific scenario, not a different type.
--
-- This also folds in the plain-unique-on-soft-deletable bug fix (same class
-- already fixed for clinics/user_clinics in 20260712191500_org_admin_constraints.sql):
-- packages.deleted_at exists, so uniqueness must be scoped to active rows only.

alter table public.packages drop constraint packages_organization_id_clinic_id_package_name_key;
alter table public.packages drop constraint packages_organization_id_clinic_id_fkey;
drop index if exists public.packages_clinic_id_idx;
alter table public.packages drop column clinic_id;

create unique index packages_organization_active_name_key on public.packages (organization_id, package_name) where (deleted_at is null);

-- ------------------------------------------------------------
-- RLS: packages_select_policy is already organization-wide (no role
-- restriction) — matches the new org-wide model as-is. Only
-- packages_update_policy carries the stale single-role check
-- (current_user_role() = 'ORG_ADMIN'::text, missing ORG_OWNER), fixed here
-- using the role-join template from 20260712220000_user_clinics_rls.sql.
-- ------------------------------------------------------------
drop policy if exists "packages_update_policy" on "public"."packages";

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
