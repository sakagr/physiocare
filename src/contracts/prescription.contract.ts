import { z } from "zod";
import { pagedResultSchema } from "./shared.contract";

/**
 * Response contracts for the Prescriptions domain (F2, M8/R5). Client-safe
 * -- never imports from `src/server/**` or `src/types/database.ts`.
 * Mirrors `src/server/repositories/prescription.repository.ts` →
 * `Prescription` (the `prescriptions` table row).
 */
export const prescriptionSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  consultation_id: z.string(),
  patient_id: z.string(),
  physiotherapist_id: z.string(),
  advice: z.string().nullable(),
  followup_date: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

/** GET /api/consultations/{id}/prescriptions. */
export const prescriptionListResponseSchema = pagedResultSchema(prescriptionSchema);
