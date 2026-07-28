import { z } from "zod";
import { pagedResultSchema } from "./shared.contract";

/**
 * Response contracts for patient records (F2, M8/R3). Client-safe -- never
 * imports from `src/server/**` or `src/types/database.ts`. Mirror
 * `src/server/repositories/patient-record.repository.ts` → `PatientRecord`
 * (the `patient_records` table row).
 */
export const patientRecordSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  patient_id: z.string(),
  uploaded_by: z.string().nullable(),
  record_type: z.string(),
  title: z.string(),
  file_url: z.string(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

/**
 * `PatientRecordWithDownloadUrl` (`patient-record.service.ts`): the row plus
 * a freshly generated signed download URL. `file_url` is the raw Storage
 * object path -- present because the service returns it unchanged, but
 * `downloadUrl` is what a client should actually use. `listPatientRecords`
 * and `getPatientRecordDetails` attach it; `createPatientRecord` does not.
 */
export const patientRecordWithDownloadUrlSchema = patientRecordSchema.extend({
  downloadUrl: z.string(),
});

/** GET /api/patients/{id}/records. */
export const patientRecordListResponseSchema = pagedResultSchema(patientRecordWithDownloadUrlSchema);
