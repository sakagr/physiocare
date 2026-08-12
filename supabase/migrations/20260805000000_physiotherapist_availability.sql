-- ============================================================
-- Physiotherapist Availability: half-day unavailable window
-- ============================================================
-- Prerequisite for F6 (AGENTS.md -> Project Decisions). Adds the window a
-- half-day attendance record is *unavailable* for, so booking and
-- rescheduling can be blocked against it (see appointment.service.ts).

alter table public.user_attendance
  add column unavailable_from time null,
  add column unavailable_to time null;

comment on column public.user_attendance.unavailable_from is
  'Start of the period the person is NOT available (a half_day record''s unavailable window) -- not the start of their working hours.';
comment on column public.user_attendance.unavailable_to is
  'End of the period the person is NOT available (a half_day record''s unavailable window) -- not the end of their working hours.';

-- Backfill before the third constraint below makes the pairing mandatory:
-- any existing half_day row (there are none in supabase/scripts/seed.js or
-- tests/e2e/global-setup.ts, but a developer's local database may have one)
-- gets a default window rather than failing the migration.
update public.user_attendance
  set unavailable_from = time '09:00', unavailable_to = time '13:00'
  where status = 'half_day' and unavailable_from is null;

alter table public.user_attendance
  add constraint user_attendance_unavailable_window_both_or_neither_check
    check ((unavailable_from is null) = (unavailable_to is null)),
  add constraint user_attendance_unavailable_window_order_check
    check (unavailable_from is null or unavailable_from < unavailable_to),
  add constraint user_attendance_unavailable_window_half_day_check
    check ((status = 'half_day') = (unavailable_from is not null));
