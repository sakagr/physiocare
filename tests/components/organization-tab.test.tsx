import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { OrganizationTab } from "@/features/organization/components/organization-tab";
import type { OrganizationDetail } from "@/types/contracts/organization";
import { currentUserFixtures } from "../helpers/current-user";
import { renderWithProviders, screen } from "../helpers/render";

const patch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: (...args: unknown[]) => patch(...args), delete: vi.fn() },
}));

const organization: OrganizationDetail = {
  id: "org-1",
  organizationName: "Riverside Physio",
  defaultCurrencyCode: "USD",
  status: "active",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  subscription: null,
};

/** Organization tab (M1): editable for Owner, read-only for Admin (decision 4). */
describe("OrganizationTab", () => {
  it("lets an Owner edit and save the profile", async () => {
    patch.mockResolvedValue({ id: "org-1", organization_name: "Riverside Physio Group" });
    const user = userEvent.setup();
    renderWithProviders(<OrganizationTab organization={organization} />, { currentUser: currentUserFixtures.owner() });

    const nameInput = screen.getByLabelText("Organization name");
    expect(nameInput).toHaveValue("Riverside Physio");
    await user.clear(nameInput);
    await user.type(nameInput, "Riverside Physio Group");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(patch).toHaveBeenCalledWith("/api/organizations/org-1", {
      organizationName: "Riverside Physio Group",
      defaultCurrencyCode: "USD",
    });
    expect(await screen.findByText("Organization profile updated.")).toBeInTheDocument();
  });

  it("shows a read-only view for an Admin, with no save control", () => {
    renderWithProviders(<OrganizationTab organization={organization} />, { currentUser: currentUserFixtures.admin() });

    expect(screen.getByText("Riverside Physio")).toBeInTheDocument();
    expect(screen.getByText("USD")).toBeInTheDocument();
    expect(screen.queryByLabelText("Organization name")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
    expect(screen.getByText("Only the Owner can edit these fields.")).toBeInTheDocument();
  });
});
