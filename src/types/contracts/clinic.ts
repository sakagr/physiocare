import type { z } from "zod";
import {
  clinicSchema,
  clinicListResponseSchema,
  userClinicsResponseSchema,
} from "@/contracts/clinic.contract";

/**
 * Response types for the Clinics domain (F3). Client-safe: this module must
 * never import from `src/server` or `src/types/database.ts`. Re-exported
 * `z.infer`s of `src/contracts/clinic.contract.ts`, the single source both
 * this module and the generated OpenAPI spec derive from (ADR-0008).
 */

export type Clinic = z.infer<typeof clinicSchema>;

/** GET /api/clinics. */
export type ClinicListResponse = z.infer<typeof clinicListResponseSchema>;

/** GET /api/users/{id}/clinics. */
export type UserClinicsResponse = z.infer<typeof userClinicsResponseSchema>;
