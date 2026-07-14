import { z } from "zod";

/**
 * Validation schema for selecting a subscription plan for an organization.
 */
export const selectSubscriptionPlanSchema = z.object({
  planName: z.string().trim().min(1, { message: "Plan name is required." }),
});

/**
 * Validation schema for activating an organization's subscription.
 */
export const activateSubscriptionSchema = z.object({
  cycle: z.enum(["monthly", "yearly"]),
});

export type SelectSubscriptionPlanInput = z.infer<typeof selectSubscriptionPlanSchema>;
export type ActivateSubscriptionInput = z.infer<typeof activateSubscriptionSchema>;

export function validateSelectSubscriptionPlanInput(input: unknown): SelectSubscriptionPlanInput {
  return selectSubscriptionPlanSchema.parse(input);
}

export function validateActivateSubscriptionInput(input: unknown): ActivateSubscriptionInput {
  return activateSubscriptionSchema.parse(input);
}
