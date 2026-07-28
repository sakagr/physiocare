import { describe, expect, it } from "vitest";
import {
  patientPackageListResponseSchema,
  patientPackageSchema,
  packageSessionUsageListResponseSchema,
} from "@/contracts/patient-package.contract";

/**
 * Response contracts for patient package assignments (F2, M8/R3-R4),
 * mirroring `src/server/repositories/patient-package.repository.ts` →
 * `PatientPackage` (the `patient_packages` table row -- a frozen
 * price/session snapshot at purchase time) and `package_session_usage`.
 */
const patientPackageFixture = {
  id: "pp-1",
  organization_id: "org-1",
  patient_id: "patient-1",
  package_id: "package-1",
  package_name: "10-Session Physio Bundle",
  package_price: 500,
  total_sessions: 10,
  remaining_sessions: 7,
  used_sessions: 3,
  status: "active",
  purchased_on: "2026-01-01",
  expiry_date: "2026-07-01",
  extended_validity_to: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
};

describe("patientPackageSchema", () => {
  it("parses a patient package assignment row", () => {
    expect(patientPackageSchema.parse(patientPackageFixture)).toEqual(patientPackageFixture);
  });
});

describe("patientPackageListResponseSchema", () => {
  it("parses the paginated list (GET /api/patients/{id}/packages, GET /api/patient-packages)", () => {
    const fixture = { items: [patientPackageFixture], total: 1, page: 1, pageSize: 10, totalPages: 1 };
    expect(patientPackageListResponseSchema.parse(fixture)).toEqual(fixture);
  });
});

describe("packageSessionUsageListResponseSchema", () => {
  it("parses the paginated session usage list (GET /api/patient-packages/{id}/usage)", () => {
    const usageFixture = {
      id: "usage-1",
      organization_id: "org-1",
      patient_package_id: "pp-1",
      appointment_id: "appt-1",
      used_on: "2026-02-01T00:00:00Z",
      created_at: "2026-02-01T00:00:00Z",
      updated_at: "2026-02-01T00:00:00Z",
      deleted_at: null,
    };
    const fixture = { items: [usageFixture], total: 1, page: 1, pageSize: 10, totalPages: 1 };
    expect(packageSessionUsageListResponseSchema.parse(fixture)).toEqual(fixture);
  });
});
