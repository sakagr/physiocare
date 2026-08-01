import { describe, expect, it } from "vitest";
import { bootstrapOrganizationResultSchema, organizationDetailSchema, organizationSchema } from "@/contracts/organization.contract";

/**
 * Response contracts for the Organizations domain (F2, M8/R8), mirroring
 * `src/server/repositories/organization.repository.ts` → `Organization`
 * (the `organizations` table row) and `organization.service.ts` →
 * `BootstrapOrganizationResult`.
 */
const organizationFixture = {
  id: "org-1",
  organization_name: "Riverside Physio",
  status: "active",
  subscription_plan_id: "plan-1",
  subscription_status: "trialing",
  subscription_starts_at: "2026-01-01T00:00:00Z",
  subscription_ends_at: "2026-01-15T00:00:00Z",
  default_currency_code: "USD",
  created_by: "user-super",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
};

describe("organizationSchema", () => {
  it("parses an organization row", () => {
    expect(organizationSchema.parse(organizationFixture)).toEqual(organizationFixture);
  });
});

describe("bootstrapOrganizationResultSchema", () => {
  it("parses the bootstrap result (POST /api/organizations/bootstrap)", () => {
    const fixture = { organizationId: "org-1", adminUserId: "user-owner", adminUsername: "riverside.owner" };
    expect(bootstrapOrganizationResultSchema.parse(fixture)).toEqual(fixture);
  });
});

describe("organizationDetailSchema", () => {
  const baseFixture = {
    id: "org-1",
    organizationName: "Riverside Physio",
    defaultCurrencyCode: "USD",
    status: "active" as const,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  it("parses an Owner/SUPER_ADMIN response with the subscription block populated", () => {
    const fixture = {
      ...baseFixture,
      subscription: {
        planId: "plan-1",
        planName: "Trial",
        status: "trialing" as const,
        startsAt: "2026-01-01T00:00:00Z",
        endsAt: "2026-01-15T00:00:00Z",
        usage: { clinics: { used: 1, max: 1 }, users: { used: 3, max: 5 } },
      },
    };
    expect(organizationDetailSchema.parse(fixture)).toEqual(fixture);
  });

  it("parses an ORG_ADMIN response with subscription null", () => {
    const fixture = { ...baseFixture, subscription: null };
    expect(organizationDetailSchema.parse(fixture)).toEqual(fixture);
  });
});
