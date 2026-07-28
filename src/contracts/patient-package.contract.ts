import { z } from "zod";
import { pagedResultSchema } from "./shared.contract";

/**
 * Response contracts for patient package assignments (F2, M8/R3-R4).
 * Client-safe -- never imports from `src/server/**` or
 * `src/types/database.ts`. Mirrors
 * `src/server/repositories/patient-package.repository.ts` →
 * `PatientPackage` (the `patient_packages` table row -- a frozen
 * price/session snapshot at purchase time, never re-derived from the live
 * package catalog) and the `package_session_usage` table row.
 */
export const patientPackageSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  patient_id: z.string(),
  package_id: z.string(),
  package_name: z.string(),
  package_price: z.number(),
  total_sessions: z.number(),
  remaining_sessions: z.number(),
  used_sessions: z.number(),
  status: z.enum(["active", "completed", "expired", "cancelled"]),
  purchased_on: z.string(),
  expiry_date: z.string(),
  extended_validity_to: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

/** POST /api/patients/{id}/packages, GET /api/patients/{id}/packages, GET/PATCH/DELETE /api/patient-packages/{id}. */
export const patientPackageListResponseSchema = pagedResultSchema(patientPackageSchema);

export const packageSessionUsageSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  patient_package_id: z.string(),
  appointment_id: z.string(),
  used_on: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

/** GET /api/patient-packages/{id}/usage. */
export const packageSessionUsageListResponseSchema = pagedResultSchema(packageSessionUsageSchema);
