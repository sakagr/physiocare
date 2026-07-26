-- ============================================================
-- Audit log schema cleanup
-- ============================================================
-- D16: audit_logs.update_policy/delete_policy already unconditionally block
-- everyone (using (false)/with check (false), no is_super_admin() escape
-- hatch), so deleted_at and updated_at are unreachable schema surface on a
-- table that should be genuinely append-only. Drop them, drop the now-
-- pointless update/delete policies (RLS denies by default with no policy for
-- a command -- simpler and equivalent), and fix the stale select_policy role
-- name + missing ORG_OWNER while we're touching this table.
--
-- 2100_triggers.sql (formerly 3000_triggers.sql, renamed so its version
-- prefix sorts before the timestamped migrations instead of after all of
-- them) intentionally has no set_audit_logs_updated_at trigger: adding one
-- would reference the updated_at column dropped below.

alter table public.audit_logs drop column deleted_at;
alter table public.audit_logs drop column updated_at;

drop policy if exists "audit_logs_update_policy" on "public"."audit_logs";
drop policy if exists "audit_logs_delete_policy" on "public"."audit_logs";

drop policy if exists "audit_logs_select_policy" on "public"."audit_logs";

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
