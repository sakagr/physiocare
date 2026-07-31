import type { z } from "zod";
import { userClinicSchema } from "@/contracts/user-clinic.contract";

/**
 * Response type for user-clinic assignments (F3). Client-safe: this module
 * must never import from `src/server` or `src/types/database.ts`.
 * Re-exported `z.infer` of `src/contracts/user-clinic.contract.ts`, the
 * single source both this module and the generated OpenAPI spec derive from
 * (ADR-0008).
 */

/** POST/DELETE /api/user-clinics. */
export type UserClinic = z.infer<typeof userClinicSchema>;
