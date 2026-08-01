import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { ClinicFormDialog } from "@/features/clinics";
import { ApiError } from "@/lib/api/api-error";
import { currentUserFixtures } from "../helpers/current-user";
import { renderWithProviders, screen } from "../helpers/render";

const post = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({
  api: { get: vi.fn(), post: (...args: unknown[]) => post(...args), patch: vi.fn(), delete: vi.fn() },
}));

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Clinic name"), "North Clinic");
}

/**
 * Create clinic (UX.md → Flow 10 step 1). F4 M6: this call site renders the
 * dedicated role-varying limit-enforcement state instead of the F3-era
 * generic toast, per code and per caller role -- the same adoption as
 * CreateUserDialog.
 */
describe("ClinicFormDialog", () => {
  it("creates a clinic on success", async () => {
    post.mockResolvedValue({ id: "clinic-1", clinic_name: "North Clinic" });
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<ClinicFormDialog opened onClose={onClose} />);

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Create clinic" }));

    expect(await screen.findByText("Clinic created.")).toBeInTheDocument();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows the Owner limit-enforcement copy and keeps input intact", async () => {
    post.mockRejectedValue(new ApiError("Organization has reached its subscription plan's clinic limit", 403, "ORGANIZATION_LIMIT_EXCEEDED"));
    const user = userEvent.setup();
    renderWithProviders(<ClinicFormDialog opened onClose={vi.fn()} />, { currentUser: currentUserFixtures.owner() });

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Create clinic" }));

    expect(await screen.findByText("You've reached your plan's limit. Upgrade your plan to add more.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Settings" })).toBeInTheDocument();
    expect(screen.getByLabelText("Clinic name")).toHaveValue("North Clinic");
  });

  it("shows the softer ask-your-owner copy for a non-owner caller", async () => {
    post.mockRejectedValue(new ApiError("Organization does not have an active subscription", 402, "SUBSCRIPTION_REQUIRED"));
    const user = userEvent.setup();
    renderWithProviders(<ClinicFormDialog opened onClose={vi.fn()} />, { currentUser: currentUserFixtures.admin() });

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Create clinic" }));

    expect(await screen.findByText("Your organization's subscription isn't active. Ask your owner to renew it.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Go to Settings" })).toBeNull();
  });
});
