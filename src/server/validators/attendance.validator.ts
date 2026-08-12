import { z } from "zod";
import { paginationSchema } from "./shared.validator";

const attendanceStatusSchema = z.enum(["present", "absent", "half_day", "leave"]);

/** `HH:mm` or `HH:mm:ss`, matching the database's `time` column. */
const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
  message: "Invalid time (expected HH:mm or HH:mm:ss).",
});

/**
 * Validation schema for recording a check-in.
 * `userId` defaults to the caller (self-check-in) when omitted -- the
 * service layer decides whether the caller may record it for someone else.
 * `unavailableFrom`/`unavailableTo` describe the period the person is NOT
 * available and are required exactly when `status` is `half_day` -- the
 * same rule the database's CHECK constraints enforce.
 */
export const createAttendanceSchema = z
  .object({
    userId: z.string().uuid({ message: "Invalid user ID format." }).optional(),
    clinicId: z.string().uuid({ message: "Invalid clinic ID format." }),
    attendanceDate: z.string().date({ message: "Invalid attendance date." }).optional(),
    status: attendanceStatusSchema.default("present"),
    notes: z.string().trim().optional().or(z.literal("")),
    unavailableFrom: timeOfDaySchema.optional(),
    unavailableTo: timeOfDaySchema.optional(),
  })
  .refine((v) => (v.unavailableFrom === undefined) === (v.unavailableTo === undefined), {
    message: "unavailableFrom and unavailableTo must be provided together.",
    path: ["unavailableTo"],
  })
  .refine((v) => v.unavailableFrom === undefined || v.unavailableFrom < v.unavailableTo!, {
    message: "unavailableFrom must be before unavailableTo.",
    path: ["unavailableTo"],
  })
  .refine((v) => (v.status === "half_day") === (v.unavailableFrom !== undefined), {
    message: "half_day status requires an unavailable window; every other status must omit it.",
    path: ["unavailableFrom"],
  })
  .describe(
    "half_day status requires unavailableFrom and unavailableTo (unavailableFrom before unavailableTo); every other status must omit them."
  );

/**
 * Validation schema for an administrative attendance correction.
 * `status` and the window are each optional (a correction may touch only
 * notes), but when `status` is present the same half_day/window pairing
 * applies -- correcting the window alone, without touching status, is
 * accepted here and resolved against the existing record by the service.
 */
export const updateAttendanceSchema = z
  .object({
    status: attendanceStatusSchema.optional(),
    notes: z.string().trim().optional().or(z.literal("")),
    unavailableFrom: timeOfDaySchema.optional(),
    unavailableTo: timeOfDaySchema.optional(),
  })
  .refine((v) => (v.unavailableFrom === undefined) === (v.unavailableTo === undefined), {
    message: "unavailableFrom and unavailableTo must be provided together.",
    path: ["unavailableTo"],
  })
  .refine((v) => v.unavailableFrom === undefined || v.unavailableFrom < v.unavailableTo!, {
    message: "unavailableFrom must be before unavailableTo.",
    path: ["unavailableTo"],
  })
  .refine((v) => v.status !== "half_day" || v.unavailableFrom !== undefined, {
    message: "Setting status to half_day requires an unavailable window.",
    path: ["unavailableFrom"],
  })
  .refine((v) => v.status === undefined || v.status === "half_day" || v.unavailableFrom === undefined, {
    message: "An unavailable window may only be set together with half_day status.",
    path: ["unavailableFrom"],
  })
  .describe(
    "Setting status to half_day requires unavailableFrom/unavailableTo; setting any other status must omit them."
  );

/**
 * Validation schema for the attendance list query.
 */
export const attendanceListQuerySchema = paginationSchema.extend({
  userId: z.string().uuid({ message: "Invalid user ID format." }).optional(),
  clinicId: z.string().uuid({ message: "Invalid clinic ID format." }).optional(),
  dateFrom: z.string().date({ message: "Invalid date." }).optional(),
  dateTo: z.string().date({ message: "Invalid date." }).optional(),
  status: attendanceStatusSchema.optional(),
});

export type CreateAttendanceInput = z.infer<typeof createAttendanceSchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
export type AttendanceListQuery = z.infer<typeof attendanceListQuerySchema>;

export function validateCreateAttendanceInput(input: unknown): CreateAttendanceInput {
  return createAttendanceSchema.parse(input);
}

export function validateUpdateAttendanceInput(input: unknown): UpdateAttendanceInput {
  return updateAttendanceSchema.parse(input);
}
