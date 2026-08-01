import { describe, expect, it, vi } from "vitest";
import { SettingsPageContent } from "@/features/organization";
import { currentUserFixtures } from "../helpers/current-user";
import { renderWithProviders, screen, waitFor } from "../helpers/render";

const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({
  api: { get: (...args: unknown[]) => get(...args), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const organizationDetail = {
  id: "org-1",
  organizationName: "Riverside Physio",
  defaultCurrencyCode: "USD",
  status: "active",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  subscription: {
    planId: "plan-pro",
    planName: "Pro",
    status: "active",
    startsAt: "2026-01-01T00:00:00Z",
    endsAt: "2026-02-01T00:00:00Z",
    usage: { clinics: { used: 2, max: 5 }, users: { used: 10, max: 20 } },
  },
};

const organizationDetailAdminProjection = { ...organizationDetail, subscription: null };

/**
 * Settings destination (M1-M5 combined): consumes `GET /api/organizations/{id}`
 * and gates the Subscription tab on `subscription:manage`, matching the
 * response's own per-caller projection (`subscription: null` for Admin).
 */
describe("SettingsPageContent", () => {
  it("gives an Owner both the Organization and Subscription tabs", async () => {
    get.mockResolvedValue(organizationDetail);
    renderWithProviders(<SettingsPageContent />, { currentUser: currentUserFixtures.owner() });

    expect(await screen.findByRole("tab", { name: "Organization" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Subscription" })).toBeInTheDocument();
  });

  it("gives an Admin only the Organization tab", async () => {
    get.mockResolvedValue(organizationDetailAdminProjection);
    renderWithProviders(<SettingsPageContent />, { currentUser: currentUserFixtures.admin() });

    expect(await screen.findByRole("tab", { name: "Organization" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Subscription" })).toBeNull();
  });

  it("fetches the organization detail for the caller's own organization", async () => {
    get.mockResolvedValue(organizationDetail);
    renderWithProviders(<SettingsPageContent />, { currentUser: currentUserFixtures.owner() });

    await waitFor(() => expect(get).toHaveBeenCalledWith("/api/organizations/org-1"));
  });
});
