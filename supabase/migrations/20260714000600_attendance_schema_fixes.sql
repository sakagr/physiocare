-- ============================================================
-- Attendance schema fixes
-- ============================================================
-- D11: check_in_time must be nullable -- a present/half_day record stamps
-- it, but an absent/leave record legitimately has no check-in at all. The
-- service layer enforces the pairing (present/half_day -> timestamp
-- required, absent/leave -> must be null).
--
-- Also folds in the plain-unique-on-soft-deletable bug fix (same class
-- already fixed for clinics/user_clinics/packages): user_attendance has
-- deleted_at, so the one-row-per-user-per-day rule must be scoped to active
-- rows only.

alter table public.user_attendance alter column check_in_time drop not null;

alter table public.user_attendance drop constraint user_attendance_organization_id_user_id_attendance_date_key;
create unique index user_attendance_active_org_user_date_key on public.user_attendance (organization_id, user_id, attendance_date) where (deleted_at is null);

-- ------------------------------------------------------------
-- RLS: role-name fix + ORG_OWNER on select (update already has no role
-- restriction beyond org-scope, left as-is -- self check-out for any org
-- member is required regardless of role, and admin/receptionist correction
-- doesn't need a stricter DB-layer check than the app layer already applies)
-- ------------------------------------------------------------
drop policy if exists "user_attendance_select_policy" on "public"."user_attendance";

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
