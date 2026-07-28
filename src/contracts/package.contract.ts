import { z } from "zod";
import { pagedResultSchema } from "./shared.contract";

/**
 * Response contracts for the Packages catalog domain (F2, M8/R4).
 * Client-safe -- never imports from `src/server/**` or
 * `src/types/database.ts`. Mirrors
 * `src/server/repositories/package.repository.ts` → `Package` (the
 * `packages` table row).
 */
export const packageSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  package_name: z.string(),
  total_sessions: z.number(),
  package_price: z.number(),
  validity_days: z.number(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

/** GET /api/packages. */
export const packageListResponseSchema = pagedResultSchema(packageSchema);
