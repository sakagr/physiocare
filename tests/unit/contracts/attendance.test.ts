import { describe, expect, it } from "vitest";
import { attendanceListResponseSchema, attendanceSchema } from "@/contracts/attendance.contract";

/**
 * Response contracts for the Attendance domain (F2, M8/R5), mirroring
 * `src/server/repositories/attendance.repository.ts` → `Attendance` (the
 * `attendance` table row).
 */
const attendanceFixture = {
  id: "attendance-1",
  organization_id: "org-1",
  user_id: "user-1",
  clinic_id: "clinic-1",
  attendance_date: "2026-02-01",
  check_in_time: "2026-02-01T09:00:00Z",
  check_out_time: null,
  status: "present",
  notes: null,
  created_at: "2026-02-01T09:00:00Z",
  updated_at: "2026-02-01T09:00:00Z",
  deleted_at: null,
};

describe("attendanceSchema", () => {
  it("parses an attendance row", () => {
    expect(attendanceSchema.parse(attendanceFixture)).toEqual(attendanceFixture);
  });
});

describe("attendanceListResponseSchema", () => {
  it("parses the paginated attendance list (GET /api/attendance)", () => {
    const fixture = { items: [attendanceFixture], total: 1, page: 1, pageSize: 10, totalPages: 1 };
    expect(attendanceListResponseSchema.parse(fixture)).toEqual(fixture);
  });
});
