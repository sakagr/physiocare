import { z } from "zod";

/**
 * Standard pagination validation schema.
 */
export const paginationSchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1, { message: "Page must be at least 1." })
    .default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, { message: "Limit must be at least 1." })
    .max(100, { message: "Limit cannot exceed 100." })
    .default(10),
});

/**
 * Shared search query validation schema.
 */
export const searchQuerySchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""));

/**
 * Shared isActive status filter schema.
 */
export const isActiveFilterSchema = z
  .preprocess((val) => {
    if (val === "true" || val === true) return true;
    if (val === "false" || val === false) return false;
    return undefined;
  }, z.boolean().optional())
  .optional();

/**
 * Standard paginated query validation schema.
 */
export const sharedListQuerySchema = paginationSchema.extend({
  search: searchQuerySchema,
  isActive: isActiveFilterSchema,
});

/**
 * Standard paginated response structure.
 */
export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Calculates start (from) and end (to) bounds for Supabase range queries.
 */
export function getPaginationBounds(page: number, limit: number) {
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  return { from, to };
}
