import type { z } from "zod";
import { subscriptionPlanListResponseSchema, subscriptionPlanSchema } from "@/contracts/subscription.contract";

/**
 * Response types for the Subscription Plans domain (F4, M2). Client-safe:
 * this module must never import from `src/server` or `src/types/database.ts`.
 * Re-exported `z.infer`s of `src/contracts/subscription.contract.ts`, the
 * single source both this module and the generated OpenAPI spec derive
 * from (ADR-0008).
 */

export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>;

/** GET /api/subscription-plans. */
export type SubscriptionPlanListResponse = z.infer<typeof subscriptionPlanListResponseSchema>;
