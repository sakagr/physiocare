/**
 * Public surface of the `attendance` feature (F6). Cross-feature imports go
 * through this barrel, never deep paths (`AGENTS.md` → *Project Structure*).
 * Explicit named exports only -- never `export *`.
 */
export { attendanceQueryKeys, attendanceListQueryOptions } from "./queries";
export type { AttendanceListFilters } from "./api";
export { AttendancePageContent } from "./components/attendance-page-content";
export {
  MarkAttendanceDialog,
  type MarkAttendanceDialogProps,
} from "./components/mark-attendance-dialog";
export {
  HALF_DAY_WINDOWS,
  HALF_DAY_WINDOW_OPTIONS,
  ATTENDANCE_STATUS_OPTIONS,
  attendanceStatusRole,
  attendanceStatusLabel,
  describeStoredWindow,
  halfDayWindowValue,
  makesUnavailable,
  attendanceFormSchema,
  type AttendanceFormValues,
} from "./schemas";
