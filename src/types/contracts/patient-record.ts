import type { z } from "zod";
import {
  patientRecordSchema,
  patientRecordWithDownloadUrlSchema,
  patientRecordListResponseSchema,
} from "@/contracts/patient-record.contract";

/**
 * Response types for patient records (F5). Client-safe: this module must
 * never import from `src/server` or `src/types/database.ts`. Re-exported
 * `z.infer`s of `src/contracts/patient-record.contract.ts`, the single source
 * both this module and the generated OpenAPI spec derive from (ADR-0008).
 */

/** The bare row: POST and DELETE /api/patients/{id}/records[/{recordId}]. */
export type PatientRecord = z.infer<typeof patientRecordSchema>;

/**
 * The row plus a signed download URL. The URL is short-lived (300 s), so a
 * client must treat it as fetched-just-now rather than storing it.
 */
export type PatientRecordWithDownloadUrl = z.infer<typeof patientRecordWithDownloadUrlSchema>;

/** GET /api/patients/{id}/records. */
export type PatientRecordListResponse = z.infer<typeof patientRecordListResponseSchema>;
