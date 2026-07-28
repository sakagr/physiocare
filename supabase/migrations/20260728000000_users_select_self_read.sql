-- ============================================================
-- users_select_policy self-read fix
-- ============================================================
-- `users_select_policy` only ever admitted `is_super_admin()` or
-- `organization_id = current_organization_id()`. For every platform role
-- other than SUPER_ADMIN, `organization_id` (the row) and
-- `current_organization_id()` (the caller, looked up from their own row)
-- are both NULL -- and `NULL = NULL` is unknown, not TRUE, in SQL's
-- three-valued logic. So no platform role except SUPER_ADMIN could select
-- their own `users` row, and `GET /api/users/me` 404'd for all of them.
--
-- Adds an explicit `id = auth.uid()` clause: a user can always read their
-- own row, independent of organization scoping. Org-scoped visibility is
-- unaffected -- this only adds the one row every session already implies.

drop policy if exists "users_select_policy" on "public"."users";

create policy "users_select_policy"
on "public"."users"
as permissive
for select
to authenticated
using (
  public.is_super_admin()
  OR id = auth.uid()
  OR organization_id = public.current_organization_id()
);
