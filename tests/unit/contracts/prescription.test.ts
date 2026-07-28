import { describe, expect, it } from "vitest";
import { prescriptionListResponseSchema, prescriptionSchema } from "@/contracts/prescription.contract";

/**
 * Response contracts for the Prescriptions domain (F2, M8/R5), mirroring
 * `src/server/repositories/prescription.repository.ts` → `Prescription`
 * (the `prescriptions` table row).
 */
const prescriptionFixture = {
  id: "prescription-1",
  organization_id: "org-1",
  consultation_id: "consultation-1",
  patient_id: "patient-1",
  physiotherapist_id: "user-physio",
  advice: "Ice the area twice daily.",
  followup_date: "2026-02-15",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("prescriptionSchema", () => {
  it("parses a prescription row", () => {
    expect(prescriptionSchema.parse(prescriptionFixture)).toEqual(prescriptionFixture);
  });
});

describe("prescriptionListResponseSchema", () => {
  it("parses the paginated prescription list (GET /api/consultations/{id}/prescriptions)", () => {
    const fixture = { items: [prescriptionFixture], total: 1, page: 1, pageSize: 10, totalPages: 1 };
    expect(prescriptionListResponseSchema.parse(fixture)).toEqual(fixture);
  });
});
