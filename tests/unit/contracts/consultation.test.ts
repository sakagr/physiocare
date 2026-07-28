import { describe, expect, it } from "vitest";
import { consultationListResponseSchema, consultationSchema } from "@/contracts/consultation.contract";

/**
 * Response contracts for the Consultations domain (F2, M8/R5), mirroring
 * `src/server/repositories/consultation.repository.ts` → `Consultation`
 * (the `consultations` table row).
 */
const consultationFixture = {
  id: "consultation-1",
  organization_id: "org-1",
  appointment_id: "appointment-1",
  patient_id: "patient-1",
  physiotherapist_id: "user-physio",
  symptoms: "Lower back pain",
  pain_areas: ["lower back"],
  pain_scale: 6,
  diagnosis_notes: null,
  followup_notes: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("consultationSchema", () => {
  it("parses a consultation row", () => {
    expect(consultationSchema.parse(consultationFixture)).toEqual(consultationFixture);
  });
});

describe("consultationListResponseSchema", () => {
  it("parses the paginated consultation list (GET /api/consultations)", () => {
    const fixture = { items: [consultationFixture], total: 1, page: 1, pageSize: 10, totalPages: 1 };
    expect(consultationListResponseSchema.parse(fixture)).toEqual(fixture);
  });
});
