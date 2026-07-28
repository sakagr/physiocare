import { describe, expect, it } from "vitest";
import {
  patientRecordListResponseSchema,
  patientRecordSchema,
  patientRecordWithDownloadUrlSchema,
} from "@/contracts/patient-record.contract";

/**
 * Response contracts for patient records (F2, M8/R3): the bare row
 * `createPatientRecord` returns (POST), and the row plus a signed download
 * URL that `listPatientRecords`/`getPatientRecordDetails` attach (GET).
 */
const bareRecordFixture = {
  id: "record-1",
  organization_id: "org-1",
  patient_id: "patient-1",
  uploaded_by: "user-1",
  record_type: "lab_report",
  title: "Blood panel",
  file_url: "org-1/patient-1/uuid-blood-panel.pdf",
  notes: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const recordFixture = {
  ...bareRecordFixture,
  downloadUrl: "https://storage.example.test/signed/blood-panel.pdf",
};

describe("patientRecordSchema", () => {
  it("parses the bare row returned on upload (POST /api/patients/{id}/records)", () => {
    expect(patientRecordSchema.parse(bareRecordFixture)).toEqual(bareRecordFixture);
  });
});

describe("patientRecordWithDownloadUrlSchema", () => {
  it("parses a record with its signed download URL", () => {
    expect(patientRecordWithDownloadUrlSchema.parse(recordFixture)).toEqual(recordFixture);
  });
});

describe("patientRecordListResponseSchema", () => {
  it("parses the paginated record list (GET /api/patients/{id}/records)", () => {
    const fixture = { items: [recordFixture], total: 1, page: 1, pageSize: 10, totalPages: 1 };
    expect(patientRecordListResponseSchema.parse(fixture)).toEqual(fixture);
  });
});
