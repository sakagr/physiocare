import { z } from "zod";
import type { SemanticRole } from "@/lib/theme";
import type { Attendance } from "@/types/contracts/attendance";

/**
 * Client form schema and vocabulary for the Attendance domain (F6).
 * Feature-owned and separate from the server validator.
 */

/**
 * **The two fixed half-day windows, pinned in `UX.md` at Flow 14.**
 *
 * Offered as exactly two choices rather than free `time` inputs, and that is
 * load-bearing rather than cosmetic. The server accepts *any* window: it
 * validates the format, the pairing, the ordering, and that a window exists
 * exactly when the status is `half_day` -- but never the values. More
 * importantly, an update supplying a window **without** a status is silently
 * discarded server-side, an accepted behaviour the availability phase
 * recorded and deliberately did not close. A two-choice control designs that
 * case out at the point of entry: a window can never be submitted without an
 * accompanying `half_day` status.
 *
 * These values are read from `UX.md`, not decided here. Changing them is a
 * `UX.md` amendment first.
 */
export const HALF_DAY_WINDOWS = [
  { from: "09:00", to: "14:00", label: "Morning (09:00–14:00)" },
  { from: "14:00", to: "19:00", label: "Afternoon (14:00–19:00)" },
] as const;

export function halfDayWindowValue(from: string, to: string): string {
  return `${from.slice(0, 5)}-${to.slice(0, 5)}`;
}

export const HALF_DAY_WINDOW_OPTIONS = HALF_DAY_WINDOWS.map((window) => ({
  value: halfDayWindowValue(window.from, window.to),
  label: window.label,
}));

/**
 * A stored window matching neither choice can exist -- written directly
 * through the API, or backfilled by the availability migration at
 * `09:00`–`13:00`. It is shown as it is and requires an explicit choice to
 * change; it is never silently snapped to one of the two.
 */
export function describeStoredWindow(from: string | null, to: string | null): string | null {
  if (!from || !to) return null;
  const value = halfDayWindowValue(from, to);
  const known = HALF_DAY_WINDOW_OPTIONS.find((option) => option.value === value);
  return known ? known.label : `${from.slice(0, 5)}–${to.slice(0, 5)} (recorded)`;
}

export const ATTENDANCE_STATUS_OPTIONS = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "half_day", label: "Half day" },
  { value: "leave", label: "Leave" },
];

/**
 * Attendance status → semantic role. Owned here, passed to `StatusBadge`;
 * the primitive stays domain-blind. `absent` is a warning rather than a
 * danger -- an unrecorded day is a scheduling fact, not a failure.
 */
const ATTENDANCE_STATUS_ROLES: Record<Attendance["status"], SemanticRole> = {
  present: "success",
  half_day: "info",
  absent: "warning",
  leave: "neutral",
};

export function attendanceStatusRole(status: Attendance["status"]): SemanticRole {
  return ATTENDANCE_STATUS_ROLES[status];
}

export function attendanceStatusLabel(status: Attendance["status"]): string {
  return ATTENDANCE_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

/** Statuses that make the person unavailable, and so clear their schedule. */
export function makesUnavailable(status: string): boolean {
  return status === "absent" || status === "leave" || status === "half_day";
}

export const attendanceFormSchema = z
  .object({
    /** Empty means "for myself". */
    userId: z.string().optional(),
    clinicId: z.string().min(1, { message: "Choose a clinic." }),
    attendanceDate: z.string().min(1, { message: "Choose a date." }),
    status: z.string().min(1),
    halfDayWindow: z.string().optional(),
    notes: z.string().trim().optional(),
  })
  .refine((values) => values.status !== "half_day" || Boolean(values.halfDayWindow), {
    message: "Choose which half of the day they are unavailable.",
    path: ["halfDayWindow"],
  });

export type AttendanceFormValues = z.infer<typeof attendanceFormSchema>;
