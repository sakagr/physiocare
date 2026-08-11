import type { z } from "zod";
import { patientSchema, patientListResponseSchema } from "@/contracts/patient.contract";

/**
 * Response types for the Patients domain (F5). Client-safe: this module must
 * never import from `src/server` or `src/types/database.ts`. Re-exported
 * `z.infer`s of `src/contracts/patient.contract.ts`, the single source both
 * this module and the generated OpenAPI spec derive from (ADR-0008).
 */

export type Patient = z.infer<typeof patientSchema>;

/** GET /api/patients. */
export type PatientListResponse = z.infer<typeof patientListResponseSchema>;
