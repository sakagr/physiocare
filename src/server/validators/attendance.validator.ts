import { z } from "zod";
import { paginationSchema } from "./shared.validator";

const attendanceStatusSchema = z.enum(["present", "absent", "half_day", "leave"]);

/**
 * Validation schema for recording a check-in.
 * `userId` defaults to the caller (self-check-in) when omitted -- the
 * service layer decides whether the caller may record it for someone else.
 */
export const createAttendanceSchema = z.object({
  userId: z.string().uuid({ message: "Invalid user ID format." }).optional(),
  clinicId: z.string().uuid({ message: "Invalid clinic ID format." }),
  attendanceDate: z.string().date({ message: "Invalid attendance date." }).optional(),
  status: attendanceStatusSchema.default("present"),
  notes: z.string().trim().optional().or(z.literal("")),
});

/**
 * Validation schema for an administrative attendance correction.
 */
export const updateAttendanceSchema = z.object({
  status: attendanceStatusSchema.optional(),
  notes: z.string().trim().optional().or(z.literal("")),
});

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
