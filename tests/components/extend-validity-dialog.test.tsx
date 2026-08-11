import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { ExtendValidityDialog } from "@/features/patient-packages";
import { ApiError } from "@/lib/api/api-error";
import { currentUserFixtures } from "../helpers/current-user";
import { renderWithProviders, screen } from "../helpers/render";

const patch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    postForm: vi.fn(),
    patch: (...args: unknown[]) => patch(...args),
    delete: vi.fn(),
  },
}));

const assignment = {
  id: "assignment-1",
  organization_id: "org-1",
  patient_id: "patient-1",
  package_id: "package-1",
  package_name: "10-Session Physio",
  package_price: 5000,
  total_sessions: 10,
  remaining_sessions: 10,
  used_sessions: 0,
  status: "active" as const,
  purchased_on: "2026-01-01",
  expiry_date: "2026-04-01",
  extended_validity_to: null,
  cancelled_at: null,
  cancelled_by: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
};

/**
 * A form dialog over a gated write, so it renders the dedicated enforcement
 * state (UX.md → *Which surface gets which treatment*). The rule keys on the
 * surface, not the verb: this is neither a create nor a destructive action,
 * and it takes the state anyway because it stays open and holds input.
 */
describe("ExtendValidityDialog", () => {
  it("extends validity on success", async () => {
    patch.mockResolvedValue({ ...assignment, extended_validity_to: "2026-06-01" });
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<ExtendValidityDialog opened onClose={onClose} assignment={assignment} />);

    await user.type(screen.getByLabelText("New expiry date"), "2026-06-01");
    await user.click(screen.getByRole("button", { name: "Extend" }));

    expect(await screen.findByText("Validity extended.")).toBeInTheDocument();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows the dedicated enforcement state and keeps input intact on SUBSCRIPTION_REQUIRED", async () => {
    patch.mockRejectedValue(
      new ApiError("Organization does not have an active subscription", 402, "SUBSCRIPTION_REQUIRED")
    );
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<ExtendValidityDialog opened onClose={onClose} assignment={assignment} />, {
      currentUser: currentUserFixtures.owner(),
    });

    await user.type(screen.getByLabelText("New expiry date"), "2026-06-01");
    await user.click(screen.getByRole("button", { name: "Extend" }));

    expect(
      await screen.findByText(
        "Your organization doesn't have an active subscription. Select or renew a plan to continue."
      )
    ).toBeInTheDocument();
    // Open, with the typed date still there: the point of the state over a toast.
    expect(screen.getByLabelText("New expiry date")).toHaveValue("2026-06-01");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows the softer ask-your-owner copy for a caller who cannot fix it", async () => {
    patch.mockRejectedValue(
      new ApiError("Organization does not have an active subscription", 402, "SUBSCRIPTION_REQUIRED")
    );
    const user = userEvent.setup();
    renderWithProviders(<ExtendValidityDialog opened onClose={vi.fn()} assignment={assignment} />, {
      currentUser: currentUserFixtures.receptionist(),
    });

    await user.type(screen.getByLabelText("New expiry date"), "2026-06-01");
    await user.click(screen.getByRole("button", { name: "Extend" }));

    expect(
      await screen.findByText("Your organization's subscription isn't active. Ask your owner to renew it.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Go to Settings" })).toBeNull();
  });
});
