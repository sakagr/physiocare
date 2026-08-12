import { z } from "zod";
import { pagedResultSchema } from "./shared.contract";

/**
 * Response contracts for the Attendance domain (F2, M8/R5). Client-safe --
 * never imports from `src/server/**` or `src/types/database.ts`. Mirrors
 * `src/server/repositories/attendance.repository.ts` → `Attendance` (the
 * `attendance` table row).
 */
export const attendanceSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  user_id: z.string(),
  clinic_id: z.string(),
  attendance_date: z.string(),
  check_in_time: z.string().nullable(),
  check_out_time: z.string().nullable(),
  status: z.enum(["present", "absent", "half_day", "leave"]),
  notes: z.string().nullable(),
  /** The period the person is NOT available -- set exactly when status is half_day. */
  unavailable_from: z.string().nullable(),
  unavailable_to: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

/** GET /api/attendance. */
export const attendanceListResponseSchema = pagedResultSchema(attendanceSchema);

/**
 * Response for the two attendance write operations (POST /api/attendance,
 * PATCH /api/attendance/{id}), both of which route through
 * attendance-workflow.service.ts. The four id arrays are always present
 * (possibly empty) rather than folded into a count, so the client can tell
 * which appointments were cancelled, skipped, or failed.
 */
export const recordAttendanceResultSchema = z.object({
  attendance: attendanceSchema,
  cancelledAppointmentIds: z.array(z.string()),
  skippedCheckedInAppointmentIds: z.array(z.string()),
  failedCancellationIds: z.array(z.string()),
  failedNotificationAppointmentIds: z.array(z.string()),
});
