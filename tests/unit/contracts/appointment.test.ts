import { describe, expect, it } from "vitest";
import {
  appointmentListResponseSchema,
  appointmentReadSchema,
  appointmentSchema,
} from "@/contracts/appointment.contract";

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

/** The read shape (F6): the row, its display projection (D1), its hints (D13). */
const appointmentReadFixture = {
  ...appointmentFixture,
  patient: { id: "patient-1", full_name: "Asha Rao", patient_code: "P-0001" },
  physiotherapist: { id: "user-physio", full_name: "Dr Menon" },
  clinic: { id: "clinic-1", clinic_name: "North Clinic" },
  allowedTransitions: ["confirmed", "checked_in", "cancelled", "no_show"],
  canManageConsultation: true,
};

describe("appointmentSchema", () => {
  it("parses an appointment row", () => {
    expect(appointmentSchema.parse(appointmentFixture)).toEqual(appointmentFixture);
  });

  it("stays the bare row, with no display projection (D12)", () => {
    // The write responses parse against this schema, and a write returns the
    // row it just persisted without re-reading it through the joined select.
    // If the projection were required here, every write would have to pay that
    // round trip purely to satisfy its own contract.
    expect(appointmentSchema.parse(appointmentReadFixture)).not.toHaveProperty("patient");
  });
});

describe("appointmentReadSchema", () => {
  it("parses a row with its display projection", () => {
    expect(appointmentReadSchema.parse(appointmentReadFixture)).toEqual(appointmentReadFixture);
  });

  it("accepts a null embed, which is how RLS filters a joined row (ADR-0011)", () => {
    const filtered = { ...appointmentReadFixture, patient: null, physiotherapist: null, clinic: null };
    expect(appointmentReadSchema.parse(filtered)).toEqual(filtered);
  });

  it("accepts an empty transition set, which is what a terminal or inaccessible row carries", () => {
    const terminal = { ...appointmentReadFixture, status: "cancelled", allowedTransitions: [] };
    expect(appointmentReadSchema.parse(terminal).allowedTransitions).toEqual([]);
  });

  it("rejects a transition that is not an appointment status", () => {
    expect(() =>
      appointmentReadSchema.parse({ ...appointmentReadFixture, allowedTransitions: ["rescheduled"] })
    ).toThrow();
  });

  it("requires each embed key to be present, so a missing join is not silently absent", () => {
    expect(() => appointmentReadSchema.parse(appointmentFixture)).toThrow();
  });
});

describe("appointmentListResponseSchema", () => {
  it("parses the paginated appointment list (GET /api/appointments)", () => {
    const fixture = { items: [appointmentReadFixture], total: 1, page: 1, pageSize: 10, totalPages: 1 };
    expect(appointmentListResponseSchema.parse(fixture)).toEqual(fixture);
  });
});
