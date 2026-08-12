import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Attendance } from "../repositories/attendance.repository";
import { findAttendanceById } from "../repositories/attendance.repository";
import { recordCheckIn, updateAttendanceRecord } from "./attendance.service";
import { cancelAppointmentAsSystem } from "./appointment.service";
import { listActiveAppointmentsForPhysiotherapistInRange } from "../repositories/appointment.repository";
import { recordSystemNotification } from "./notification.service";
import { recordAuditLogSafe } from "./audit-log.service";
import type { CreateAttendanceInput, UpdateAttendanceInput } from "../validators/attendance.validator";

/**
 * Result of an attendance write that may have auto-cancelled appointments.
 * The four arrays are always present (possibly empty), never merged into a
 * single count, so a caller can tell *which* appointments were affected --
 * needed for both the UI and D-F's "failures are reported, never silently
 * dropped" rule.
 */
export interface RecordAttendanceResult {
  attendance: Attendance;
  cancelledAppointmentIds: string[];
  skippedCheckedInAppointmentIds: string[];
  failedCancellationIds: string[];
  failedNotificationAppointmentIds: string[];
}

/** Renders an unknown thrown value for a warning log, never the message body of a data row. */
function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

const AUTO_CANCEL_ELIGIBLE_STATUSES: Database["public"]["Enums"]["appointment_status"][] = ["scheduled", "confirmed"];
const UNAVAILABLE_STATUSES: Database["public"]["Enums"]["attendance_status"][] = ["absent", "leave", "half_day"];

/** "mark_unavailable" is the domain verb for the effectful markings; the plain record/correct verbs cover the rest. */
function auditAction(status: Attendance["status"], kind: "record" | "correct"): string {
  return UNAVAILABLE_STATUSES.includes(status) ? "mark_unavailable" : kind;
}

function isInsideHalfDayWindow(attendance: Attendance, appointmentTimeIso: string): boolean {
  if (attendance.unavailable_from === null || attendance.unavailable_to === null) return false;
  const clockTime = new Date(appointmentTimeIso).toISOString().slice(11, 19);
  return clockTime >= attendance.unavailable_from && clockTime < attendance.unavailable_to;
}

/**
 * Cancels every eligible appointment the marked physiotherapist has on the
 * attendance date and notifies each affected patient, for a marking that
 * makes them unavailable (absent/leave/half_day). A `present` marking (or a
 * correction back to it) is a no-op -- see D-H.
 *
 * Runs the appointment listing and every cancel on the **admin client**
 * (D-I): a receptionist's own session would filter the listing to her
 * assigned clinics and fail the update outside them, silently half-clearing
 * the schedule. The listing is organization-wide, never scoped to
 * `attendance.clinic_id` -- unavailability is organization-wide, not per
 * clinic (D-N): the partial unique index on
 * (organization_id, user_id, attendance_date) permits only one live
 * attendance row per person per day, so "absent at clinic A, present at
 * clinic B" cannot exist. The notification write stays on the caller's
 * **session client** -- `notifications_insert_policy` is org-scoped and
 * admits it, so no admin authority is needed there (D-I).
 *
 * Per-appointment: cancel, then notify. A notification failure never
 * unwinds the cancellation, and a cancellation failure never unwinds
 * earlier ones -- the physiotherapist genuinely is unavailable, and
 * restoring a visit nobody will deliver is worse than a missing reminder
 * (D-F). Both kinds of failure are collected and reported, never silently
 * dropped.
 */
async function applyUnavailability(
  supabase: SupabaseClient<Database>,
  adminClient: SupabaseClient<Database>,
  changedByUserId: string,
  attendance: Attendance
): Promise<Omit<RecordAttendanceResult, "attendance">> {
  const cancelledAppointmentIds: string[] = [];
  const skippedCheckedInAppointmentIds: string[] = [];
  const failedCancellationIds: string[] = [];
  const failedNotificationAppointmentIds: string[] = [];

  if (!UNAVAILABLE_STATUSES.includes(attendance.status)) {
    return { cancelledAppointmentIds, skippedCheckedInAppointmentIds, failedCancellationIds, failedNotificationAppointmentIds };
  }

  const dayStart = `${attendance.attendance_date}T00:00:00.000Z`;
  const dayEnd = `${attendance.attendance_date}T23:59:59.999Z`;

  const appointments = await listActiveAppointmentsForPhysiotherapistInRange(
    adminClient,
    attendance.organization_id,
    attendance.user_id,
    dayStart,
    dayEnd
  );

  for (const appointment of appointments) {
    if (appointment.status === "checked_in") {
      skippedCheckedInAppointmentIds.push(appointment.id);
      continue;
    }
    if (!AUTO_CANCEL_ELIGIBLE_STATUSES.includes(appointment.status)) {
      continue;
    }
    if (attendance.status === "half_day" && !isInsideHalfDayWindow(attendance, appointment.appointment_time)) {
      continue;
    }

    try {
      await cancelAppointmentAsSystem(adminClient, attendance.organization_id, appointment.id, changedByUserId);
      cancelledAppointmentIds.push(appointment.id);
    } catch (error) {
      failedCancellationIds.push(appointment.id);
      console.warn("[attendance-workflow] failed to auto-cancel appointment", {
        appointmentId: appointment.id,
        error: describeError(error),
      });
      continue;
    }

    try {
      await recordSystemNotification(supabase, attendance.organization_id, {
        recipientType: "patient",
        patientId: appointment.patient_id,
        appointmentId: appointment.id,
        notificationType: "appointment_cancelled_unavailable",
        channel: "in_app",
        message: "Your appointment has been cancelled because your physiotherapist is unavailable.",
      });
    } catch (error) {
      failedNotificationAppointmentIds.push(appointment.id);
      console.warn("[attendance-workflow] failed to write cancellation notification", {
        appointmentId: appointment.id,
        error: describeError(error),
      });
    }
  }

  return { cancelledAppointmentIds, skippedCheckedInAppointmentIds, failedCancellationIds, failedNotificationAppointmentIds };
}

/**
 * Records attendance and applies its availability effect. The only public
 * entry point for recording attendance -- `attendance.service.ts`'s
 * `recordCheckIn` is called from here and nowhere else outside this module
 * (D-L).
 */
export async function recordAttendance(
  supabase: SupabaseClient<Database>,
  adminClient: SupabaseClient<Database>,
  callerUserId: string,
  input: CreateAttendanceInput
): Promise<RecordAttendanceResult> {
  const attendance = await recordCheckIn(supabase, callerUserId, input);
  const effect = await applyUnavailability(supabase, adminClient, callerUserId, attendance);

  await recordAuditLogSafe(supabase, {
    organizationId: attendance.organization_id,
    userId: callerUserId,
    action: auditAction(attendance.status, "record"),
    entityName: "user_attendance",
    entityId: attendance.id,
    newData: attendance,
  });

  return { attendance, ...effect };
}

/**
 * Corrects attendance and re-applies its availability effect. The only
 * public entry point for updating attendance -- `attendance.service.ts`'s
 * `updateAttendanceRecord` is called from here and nowhere else outside
 * this module (D-L). Runs the same effect a recording does: a status
 * corrected into place must clear the schedule exactly as it would have if
 * recorded correctly the first time, and a corrected half-day window must
 * be re-applied so the cancelled set matches the window actually on the
 * record (D-H). Re-application only ever cancels appointments the
 * corrected state newly covers -- it never restores one already cancelled
 * under a wider or different prior state (D-F).
 */
export async function updateAttendance(
  supabase: SupabaseClient<Database>,
  adminClient: SupabaseClient<Database>,
  callerUserId: string,
  attendanceId: string,
  input: UpdateAttendanceInput
): Promise<RecordAttendanceResult> {
  const before = await findAttendanceById(supabase, attendanceId);
  const attendance = await updateAttendanceRecord(supabase, callerUserId, attendanceId, input);
  const effect = await applyUnavailability(supabase, adminClient, callerUserId, attendance);

  await recordAuditLogSafe(supabase, {
    organizationId: attendance.organization_id,
    userId: callerUserId,
    action: auditAction(attendance.status, "correct"),
    entityName: "user_attendance",
    entityId: attendance.id,
    oldData: before,
    newData: attendance,
  });

  return { attendance, ...effect };
}
