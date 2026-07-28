import { z } from "zod";

/**
 * Response contracts shared across domains (F2, ADR-0008).
 *
 * Client-safe: this module must never import from `src/server/**` or
 * `src/types/database.ts` (same rule as `src/types/contracts/me.ts`). It is
 * the single source both the generated OpenAPI spec and any TS type derive
 * from -- a domain contract in `src/contracts/*.contract.ts` composes
 * `pagedResultSchema` for its list responses rather than each hand-rolling
 * the paging envelope.
 */

/** The paginated list envelope every list operation returns. */
export function pagedResultSchema<Item extends z.ZodType>(itemSchema: Item) {
  return z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    totalPages: z.number().int().nonnegative(),
  });
}

/**
 * The envelope every route returns on failure (`mapErrorToResponse` in
 * `src/lib/api/route-handler.ts`). `code` is absent for the small set of
 * hand-rolled 400s that predate `AppError` (FL5) and for the plain-text
 * "Internal Server Error" case; `details` carries a `ZodError`'s issues.
 */
export const errorEnvelopeSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional(),
});

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
