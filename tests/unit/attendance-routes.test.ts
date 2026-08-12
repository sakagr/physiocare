import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  recordAttendance: vi.fn(),
  updateAttendance: vi.fn(),
  recordCheckIn: vi.fn(),
  updateAttendanceRecord: vi.fn(),
}));

const fakeUser = { id: "caller-1" };
const fakeSupabase = { auth: { getUser: async () => ({ data: { user: fakeUser }, error: null }) } };
const fakeAdminClient = { __admin: true };

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => fakeSupabase) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => fakeAdminClient) }));

// T-8.14: the domain functions are mocked too. If a future refactor repoints
// either route at attendance.service instead of the workflow, these mocks
// are never called and the assertions on the workflow mocks below fail.
vi.mock("@/server/services/attendance.service", () => ({
  recordCheckIn: mocks.recordCheckIn,
  updateAttendanceRecord: mocks.updateAttendanceRecord,
}));
vi.mock("@/server/services/attendance-workflow.service", () => ({
  recordAttendance: mocks.recordAttendance,
  updateAttendance: mocks.updateAttendance,
}));

import * as attendanceRoute from "@/app/api/attendance/route";
import * as attendanceDetailRoute from "@/app/api/attendance/[id]/route";

const request = (method: string, body?: unknown) =>
  new NextRequest("http://localhost/api/attendance", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { "content-type": "application/json" },
  });

const context = { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }) };

const fixtureResult = {
  attendance: { id: "attendance-1", status: "absent" },
  cancelledAppointmentIds: ["appt-1"],
  skippedCheckedInAppointmentIds: [],
  failedCancellationIds: [],
  failedNotificationAppointmentIds: [],
};

describe("attendance write routes reach the workflow service (task 8.3, T-8.11, T-8.14)", () => {
  it("POST /api/attendance calls the workflow's recordAttendance with an admin client, and returns RecordAttendanceResult", async () => {
    mocks.recordAttendance.mockResolvedValue(fixtureResult);

    const response = await attendanceRoute.POST(request("POST", { clinicId: "11111111-1111-4111-8111-111111111111", status: "absent" }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(fixtureResult);
    expect(mocks.recordAttendance).toHaveBeenCalledWith(
      fakeSupabase,
      fakeAdminClient,
      fakeUser.id,
      expect.objectContaining({ status: "absent" })
    );
    expect(mocks.recordCheckIn).not.toHaveBeenCalled();
  });

  it("PATCH /api/attendance/{id} calls the workflow's updateAttendance with an admin client, and returns RecordAttendanceResult", async () => {
    mocks.updateAttendance.mockResolvedValue(fixtureResult);

    const response = await attendanceDetailRoute.PATCH(request("PATCH", { status: "present" }), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(fixtureResult);
    expect(mocks.updateAttendance).toHaveBeenCalledWith(
      fakeSupabase,
      fakeAdminClient,
      fakeUser.id,
      "00000000-0000-4000-8000-000000000001",
      expect.objectContaining({ status: "present" })
    );
    expect(mocks.updateAttendanceRecord).not.toHaveBeenCalled();
  });
});
