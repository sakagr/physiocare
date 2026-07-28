import { describe, expect, it } from "vitest";
import { appointmentListResponseSchema, appointmentSchema } from "@/contracts/appointment.contract";

/**
 * Response contracts for the Appointments domain (F2, M8/R5), mirroring
 * `src/server/repositories/appointment.repository.ts` → `Appointment` (the
 * `appointments` table row).
 */
const appointmentFixture = {
  id: "appointment-1",
  organization_id: "org-1",
  patient_id: "patient-1",
  clinic_id: "clinic-1",
  physiotherapist_id: "user-physio",
  appointment_time: "2026-02-01T10:00:00Z",
  appointment_type: "therapy_session",
  status: "scheduled",
  notes: null,
  created_by: "user-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
};

describe("appointmentSchema", () => {
  it("parses an appointment row", () => {
    expect(appointmentSchema.parse(appointmentFixture)).toEqual(appointmentFixture);
  });
});

describe("appointmentListResponseSchema", () => {
  it("parses the paginated appointment list (GET /api/appointments)", () => {
    const fixture = { items: [appointmentFixture], total: 1, page: 1, pageSize: 10, totalPages: 1 };
    expect(appointmentListResponseSchema.parse(fixture)).toEqual(fixture);
  });
});
