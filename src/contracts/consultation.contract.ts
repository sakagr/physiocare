import { z } from "zod";
import { pagedResultSchema } from "./shared.contract";

/**
 * Response contracts for the Consultations domain (F2, M8/R5). Client-safe
 * -- never imports from `src/server/**` or `src/types/database.ts`.
 * Mirrors `src/server/repositories/consultation.repository.ts` →
 * `Consultation` (the `consultations` table row). `pain_areas` is stored as
 * `Json` in the database; every write path sends it as a string array, so
 * that is what this contract documents.
 */
export const consultationSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  appointment_id: z.string(),
  patient_id: z.string(),
  physiotherapist_id: z.string(),
  symptoms: z.string().nullable(),
  pain_areas: z.array(z.string()),
  pain_scale: z.number().nullable(),
  diagnosis_notes: z.string().nullable(),
  followup_notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

/** GET /api/consultations. */
export const consultationListResponseSchema = pagedResultSchema(consultationSchema);
