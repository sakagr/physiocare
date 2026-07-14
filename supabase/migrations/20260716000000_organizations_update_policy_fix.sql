-- ============================================================
-- organizations_update_policy authorization fix
-- ============================================================
-- Phase 8 review finding: the existing policy allowed any authenticated
-- user belonging to an organization (any role) to update any column on
-- their own organization row, including subscription_status and
-- subscription_plan_id. Restricted to ORG_OWNER (the organization's single
-- accountable owner) and SUPER_ADMIN, matching the framing already used
-- for organization-level decisions elsewhere (bootstrap, subscription
-- activation).

drop policy if exists "organizations_update_policy" on "public"."organizations";

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
