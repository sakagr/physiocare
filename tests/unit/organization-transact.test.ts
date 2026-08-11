import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOrganizationById: vi.fn(),
}));

vi.mock("@/server/repositories/organization.repository", () => ({
  findOrganizationById: mocks.findOrganizationById,
}));

import { canOrganizationTransact } from "@/server/services/authorization.service";

describe("canOrganizationTransact", () => {
  it("returns false when the organization does not exist", async () => {
    mocks.findOrganizationById.mockResolvedValue(null);
    expect(await canOrganizationTransact({} as never, "missing-org")).toBe(false);
  });

  it.each([
    ["active", "trialing", true],
    ["active", "active", true],
    // past_due retains access for the renewal grace period.
    ["active", "past_due", true],
    ["active", "inactive", false],
    ["active", "cancelled", false],
    ["active", "expired", false],
    // The organization dimension is independent of the subscription dimension:
    // a paid-up subscription does not let a non-active organization write.
    ["draft", "active", false],
    ["inactive", "active", false],
    ["archived", "active", false],
  ] as const)("status=%s, subscription_status=%s -> %s", async (status, subscriptionStatus, expected) => {
    mocks.findOrganizationById.mockResolvedValue({ status, subscription_status: subscriptionStatus });
    expect(await canOrganizationTransact({} as never, "org-1")).toBe(expected);
  });
});
