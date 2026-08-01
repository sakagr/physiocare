import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { PlanCatalog } from "@/features/organization/components/plan-catalog";
import { renderWithProviders, screen } from "../helpers/render";

const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({
  api: { get: (...args: unknown[]) => get(...args), post: (...args: unknown[]) => post(...args), patch: vi.fn(), delete: vi.fn() },
}));

const plans = [
  { id: "plan-trial", plan_name: "Trial", max_clinics: 1, max_users: 5, monthly_price: 0, yearly_price: 0, features: {}, created_at: "", updated_at: "", deleted_at: null },
  { id: "plan-pro", plan_name: "Pro", max_clinics: 5, max_users: 20, monthly_price: 99, yearly_price: 999, features: {}, created_at: "", updated_at: "", deleted_at: null },
];

/** Plan selection UI (M3): Trial self-service vs. paid pending-activation. */
describe("PlanCatalog", () => {
  it("selects Trial and toasts an immediate-start message", async () => {
    get.mockResolvedValue(plans);
    post.mockResolvedValue({});
    const user = userEvent.setup();
    renderWithProviders(<PlanCatalog organizationId="org-1" />);

    await user.click(await screen.findByRole("button", { name: "Select Trial" }));

    expect(post).toHaveBeenCalledWith("/api/organizations/org-1/subscription/select", { planName: "Trial" });
    expect(await screen.findByText("Trial started.")).toBeInTheDocument();
  });

  it("selects a paid plan and toasts an awaiting-activation message", async () => {
    get.mockResolvedValue(plans);
    post.mockResolvedValue({});
    const user = userEvent.setup();
    renderWithProviders(<PlanCatalog organizationId="org-1" />);

    await user.click(await screen.findByRole("button", { name: "Select Pro" }));

    expect(post).toHaveBeenCalledWith("/api/organizations/org-1/subscription/select", { planName: "Pro" });
    expect(await screen.findByText("Pro selected. Awaiting activation.")).toBeInTheDocument();
  });
});
