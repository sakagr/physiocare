import type { z } from "zod";
import {
  attendanceSchema,
  attendanceListResponseSchema,
  recordAttendanceResultSchema,
} from "@/contracts/attendance.contract";

/**
 * Response types for the Attendance domain (F6). Client-safe: never imports
 * from `src/server` or `src/types/database.ts`.
 */
export type Attendance = z.infer<typeof attendanceSchema>;

/** GET /api/attendance. */
export type AttendanceListResponse = z.infer<typeof attendanceListResponseSchema>;

/**
 * POST /api/attendance and PATCH /api/attendance/{id}. Both route through the
 * attendance workflow, so both may have cancelled appointments as a side
 * effect -- the four id arrays are what let the client say *which*.
 */
export type RecordAttendanceResult = z.infer<typeof recordAttendanceResultSchema>;
