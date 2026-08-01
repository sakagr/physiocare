import { z } from "zod";

/**
 * Response contract for the Subscription plan catalog (F4, M2). Client-safe
 * -- never imports from `src/server/**` or `src/types/database.ts`. Mirrors
 * `src/server/repositories/subscription.repository.ts` → `SubscriptionPlan`
 * (the `subscription_plans` table row). `features` is the database's `Json`
 * column type -- an arbitrary JSON value, not a fixed shape.
 */
export const subscriptionPlanSchema = z.object({
  id: z.string(),
  plan_name: z.string(),
  max_clinics: z.number(),
  max_users: z.number(),
  monthly_price: z.number(),
  yearly_price: z.number(),
  features: z.unknown(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

/** GET /api/subscription-plans. */
export const subscriptionPlanListResponseSchema = z.array(subscriptionPlanSchema);
