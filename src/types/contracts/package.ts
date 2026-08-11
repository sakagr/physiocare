import type { z } from "zod";
import { packageSchema, packageListResponseSchema } from "@/contracts/package.contract";

/**
 * Response types for the Packages catalogue domain (F5). Client-safe: this
 * module must never import from `src/server` or `src/types/database.ts`.
 * Re-exported `z.infer`s of `src/contracts/package.contract.ts`, the single
 * source both this module and the generated OpenAPI spec derive from
 * (ADR-0008).
 */

export type Package = z.infer<typeof packageSchema>;

/** GET /api/packages. */
export type PackageListResponse = z.infer<typeof packageListResponseSchema>;
