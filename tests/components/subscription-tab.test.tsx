import { describe, expect, it, vi } from "vitest";
import { SubscriptionTab } from "@/features/organization/components/subscription-tab";
import type { OrganizationDetail } from "@/types/contracts/organization";
import { renderWithProviders, screen } from "../helpers/render";

const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({
  api: { get: (...args: unknown[]) => get(...args), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const baseOrganization: OrganizationDetail = {
  id: "org-1",
  organizationName: "Riverside Physio",
  defaultCurrencyCode: "USD",
  status: "active",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  subscription: null,
};

/**
 * Subscription tab (M2-M5): three distinct states over subscription_status
 * (M3's explicit ask) plus the always-rendered disabled activation surface
 * (M4) and usage display (M5).
 */
describe("SubscriptionTab", () => {
  it("renders the plan catalog when no plan is selected", async () => {
    get.mockResolvedValue([
      { id: "plan-trial", plan_name: "Trial", max_clinics: 1, max_users: 5, monthly_price: 0, yearly_price: 0, features: {}, created_at: "", updated_at: "", deleted_at: null },
    ]);
    const organization: OrganizationDetail = {
      ...baseOrganization,
      subscription: {
        planId: "plan-none",
        planName: "NO_SUBSCRIPTION",
        status: "inactive",
        startsAt: null,
        endsAt: null,
        usage: { clinics: { used: 0, max: 1 }, users: { used: 1, max: 1 } },
      },
    };
    renderWithProviders(<SubscriptionTab organization={organization} />);

    expect(screen.getByText("Choose a plan to get started.")).toBeInTheDocument();
    expect(await screen.findByText("Trial")).toBeInTheDocument();
  });

  it("renders the limbo state for a paid plan selected but not yet active", () => {
    const organization: OrganizationDetail = {
      ...baseOrganization,
      subscription: {
        planId: "plan-pro",
        planName: "Pro",
        status: "inactive",
        startsAt: null,
        endsAt: null,
        usage: { clinics: { used: 0, max: 5 }, users: { used: 1, max: 20 } },
      },
    };
    renderWithProviders(<SubscriptionTab organization={organization} />);

    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText(/awaiting activation/i)).toBeInTheDocument();
    expect(screen.queryByText("Choose a plan to get started.")).toBeNull();
  });

  it("renders the active plan with usage and no limbo message", () => {
    const organization: OrganizationDetail = {
      ...baseOrganization,
      subscription: {
        planId: "plan-pro",
        planName: "Pro",
        status: "active",
        startsAt: "2026-01-01T00:00:00Z",
        endsAt: "2026-02-01T00:00:00Z",
        usage: { clinics: { used: 2, max: 5 }, users: { used: 10, max: 20 } },
      },
    };
    renderWithProviders(<SubscriptionTab organization={organization} />);

    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.queryByText(/awaiting activation/i)).toBeNull();
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
    expect(screen.getByText("10 / 20")).toBeInTheDocument();
  });

  it("always renders the disabled activation & renewal surface, regardless of state", () => {
    const organization: OrganizationDetail = {
      ...baseOrganization,
      subscription: {
        planId: "plan-pro",
        planName: "Pro",
        status: "active",
        startsAt: "2026-01-01T00:00:00Z",
        endsAt: "2026-02-01T00:00:00Z",
        usage: { clinics: { used: 2, max: 5 }, users: { used: 10, max: 20 } },
      },
    };
    renderWithProviders(<SubscriptionTab organization={organization} />);

    const activateButton = screen.getByRole("button", { name: "Activate" });
    const renewButton = screen.getByRole("button", { name: "Renew" });
    expect(activateButton).toBeDisabled();
    expect(renewButton).toBeDisabled();
  });
});
