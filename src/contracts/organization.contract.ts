import { z } from "zod";

/**
 * Response contracts for the Organizations domain (F2, M8/R8). Client-safe
 * -- never imports from `src/server/**` or `src/types/database.ts`.
 * Mirrors `src/server/repositories/organization.repository.ts` →
 * `Organization` (the `organizations` table row).
 */
export const organizationSchema = z.object({
  id: z.string(),
  organization_name: z.string(),
  status: z.enum(["draft", "active", "inactive", "archived"]),
  subscription_plan_id: z.string(),
  subscription_status: z.enum(["inactive", "trialing", "active", "past_due", "cancelled", "expired"]),
  subscription_starts_at: z.string().nullable(),
  subscription_ends_at: z.string().nullable(),
  default_currency_code: z.string().nullable(),
  created_by: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

/**
 * POST /api/organizations/bootstrap -- `BootstrapOrganizationResult`
 * (`organization.service.ts`). No initial password here: the owner is
 * invited by email (ADR-0007's invite flow), not handed a system-generated
 * one like an organization-created user.
 */
export const bootstrapOrganizationResultSchema = z.object({
  organizationId: z.string(),
  adminUserId: z.string(),
  adminUsername: z.string(),
});
