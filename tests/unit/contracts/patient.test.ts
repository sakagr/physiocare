import { describe, expect, it } from "vitest";
import { patientListResponseSchema, patientSchema } from "@/contracts/patient.contract";

/**
 * Response contracts for the Patients domain (F2, M8/R3), mirroring
 * `src/server/repositories/patient.repository.ts` → `Patient` (the
 * `patients` table row).
 */
const patientFixture = {
  id: "patient-1",
  organization_id: "org-1",
  patient_code: "PT-000001",
  full_name: "Jamie Rivera",
  gender: "prefer_not_to_say",
  dob: "1990-05-01",
  phone: "+1-555-0100",
  email: "jamie@example.test",
  address: "1 Main St",
  emergency_contact: "Kin Rivera +1-555-0101",
  created_by: "user-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
};

describe("patientSchema", () => {
  it("parses a patient row", () => {
    expect(patientSchema.parse(patientFixture)).toEqual(patientFixture);
  });

  it("allows every nullable field to be null", () => {
    expect(() =>
      patientSchema.parse({
        ...patientFixture,
        gender: null,
        dob: null,
        phone: null,
        email: null,
        address: null,
        emergency_contact: null,
        created_by: null,
      })
    ).not.toThrow();
  });
});

describe("patientListResponseSchema", () => {
  it("parses the paginated patient list (GET /api/patients)", () => {
    const fixture = { items: [patientFixture], total: 1, page: 1, pageSize: 10, totalPages: 1 };
    expect(patientListResponseSchema.parse(fixture)).toEqual(fixture);
  });
});
