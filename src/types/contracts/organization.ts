import type { z } from "zod";
import {
  bootstrapOrganizationResultSchema,
  organizationDetailSchema,
  organizationSchema,
} from "@/contracts/organization.contract";

/**
 * Response types for the Organizations domain (F3/F4). Client-safe: this
 * module must never import from `src/server` or `src/types/database.ts`.
 * Re-exported `z.infer`s of `src/contracts/organization.contract.ts`, the
 * single source both this module and the generated OpenAPI spec derive
 * from (ADR-0008).
 */

export type Organization = z.infer<typeof organizationSchema>;

/** POST /api/organizations/bootstrap. */
export type BootstrapOrganizationResult = z.infer<typeof bootstrapOrganizationResultSchema>;

/** GET /api/organizations/{id}. */
export type OrganizationDetail = z.infer<typeof organizationDetailSchema>;
