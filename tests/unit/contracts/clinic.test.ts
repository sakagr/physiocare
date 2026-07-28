import { describe, expect, it } from "vitest";
import {
  clinicListResponseSchema,
  clinicSchema,
  userClinicsResponseSchema,
} from "@/contracts/clinic.contract";

/**
 * Response contracts for the Clinics domain (F2, M8/R2). Each schema
 * `.parse()`s a fixture shaped like the service's real return value
 * (`src/server/repositories/clinic.repository.ts` → `Clinic`, the
 * `clinics` table row).
 */
const clinicFixture = {
  id: "clinic-1",
  organization_id: "org-1",
  clinic_name: "North Clinic",
  email: "north@example.test",
  phone: "+1-555-0100",
  address: "1 Main St",
  city: "Springfield",
  state: "IL",
  pincode: "62701",
  gst_number: null,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
};

describe("clinicSchema", () => {
  it("parses a clinic row, matching Clinic (clinic.repository.ts)", () => {
    expect(clinicSchema.parse(clinicFixture)).toEqual(clinicFixture);
  });

  it("allows every nullable field to be null", () => {
    expect(() =>
      clinicSchema.parse({ ...clinicFixture, email: null, phone: null, address: null, city: null, state: null, pincode: null })
    ).not.toThrow();
  });
});

describe("clinicListResponseSchema", () => {
  it("parses the paginated clinic list (GET /api/clinics)", () => {
    const fixture = { items: [clinicFixture], total: 1, page: 1, pageSize: 10, totalPages: 1 };
    expect(clinicListResponseSchema.parse(fixture)).toEqual(fixture);
  });
});

describe("userClinicsResponseSchema", () => {
  it("parses a bare array of clinics (GET /api/users/{id}/clinics)", () => {
    expect(userClinicsResponseSchema.parse([clinicFixture])).toEqual([clinicFixture]);
  });
});
