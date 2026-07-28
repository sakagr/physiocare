import { z } from "zod";
import { pagedResultSchema } from "./shared.contract";

/**
 * Response contracts for the Patients domain (F2, M8/R3). Client-safe --
 * never imports from `src/server/**` or `src/types/database.ts`. Mirrors
 * `src/server/repositories/patient.repository.ts` → `Patient` (the
 * `patients` table row).
 */
export const patientSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  patient_code: z.string(),
  full_name: z.string(),
  gender: z.enum(["female", "male", "other", "prefer_not_to_say"]).nullable(),
  dob: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  emergency_contact: z.string().nullable(),
  created_by: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

/** GET /api/patients. */
export const patientListResponseSchema = pagedResultSchema(patientSchema);
