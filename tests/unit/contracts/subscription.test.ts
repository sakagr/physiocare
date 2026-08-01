import { describe, expect, it } from "vitest";
import { subscriptionPlanListResponseSchema, subscriptionPlanSchema } from "@/contracts/subscription.contract";

const planFixture = {
  id: "plan-1",
  plan_name: "Trial",
  max_clinics: 1,
  max_users: 5,
  monthly_price: 0,
  yearly_price: 0,
  features: { supportTier: "standard" },
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
};

describe("subscriptionPlanSchema", () => {
  it("parses a subscription plan row", () => {
    expect(subscriptionPlanSchema.parse(planFixture)).toEqual(planFixture);
  });
});

describe("subscriptionPlanListResponseSchema", () => {
  it("parses the plan catalog (GET /api/subscription-plans)", () => {
    expect(subscriptionPlanListResponseSchema.parse([planFixture])).toEqual([planFixture]);
  });
});
