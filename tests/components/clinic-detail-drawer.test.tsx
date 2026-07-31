import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { ClinicDetailDrawer } from "@/features/clinics";
import type { Clinic } from "@/types/contracts/clinic";
import { currentUserFixtures } from "../helpers/current-user";
import { renderWithProviders, screen, waitFor } from "../helpers/render";

const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({
  api: { get: (...args: unknown[]) => get(...args), post: (...args: unknown[]) => post(...args), patch: vi.fn(), delete: vi.fn() },
}));

function makeClinic(overrides: Partial<Clinic> = {}): Clinic {
  return {
    id: "clinic-1",
    organization_id: "org-1",
    clinic_name: "North Clinic",
    email: "north@example.test",
    phone: "9876543210",
    address: "123 Main St",
    city: "Pune",
    state: "MH",
    pincode: "411001",
    gst_number: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

/** Routes the shared `get` mock by path, for the drawer plus its M6 member-list section. */
function mockGet(clinic: Clinic) {
  get.mockImplementation((path: string) => {
    if (path.includes("/users")) {
      return Promise.resolve(path.includes("/api/clinics") ? [] : { items: [], total: 0, page: 1, pageSize: 200, totalPages: 0, assignableRoles: [] });
    }
    return Promise.resolve(clinic);
  });
}

/**
 * Clinic detail (UX.md screen inventory). `clinics:manage` gates the edit
 * and activate/deactivate actions -- unlike Users, there is no per-row hint
 * since clinics have no hierarchy; capability gating is proven by swapping
 * the fixture (Owner/Admin manage, a Physiotherapist does not).
 */
describe("ClinicDetailDrawer", () => {
  it("shows manage actions for an Owner", async () => {
    mockGet(makeClinic());
    renderWithProviders(<ClinicDetailDrawer clinicId="clinic-1" onClose={vi.fn()} />, {
      currentUser: currentUserFixtures.owner(),
    });

    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deactivate" })).toBeInTheDocument();
  });

  it("hides manage actions for a physiotherapist", async () => {
    mockGet(makeClinic());
    renderWithProviders(<ClinicDetailDrawer clinicId="clinic-1" onClose={vi.fn()} />, {
      currentUser: currentUserFixtures.physiotherapist(),
    });

    await screen.findByText("North Clinic");
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Deactivate" })).toBeNull();
  });

  it("deactivates through the named confirm", async () => {
    mockGet(makeClinic());
    post.mockResolvedValue(makeClinic({ is_active: false }));
    const user = userEvent.setup();

    renderWithProviders(<ClinicDetailDrawer clinicId="clinic-1" onClose={vi.fn()} />, {
      currentUser: currentUserFixtures.owner(),
    });

    await user.click(await screen.findByRole("button", { name: "Deactivate" }));
    expect(screen.getAllByText("North Clinic").length).toBeGreaterThan(0);
    expect(screen.getByText(/no longer be assigned or booked/)).toBeInTheDocument();

    const confirmButtons = screen.getAllByRole("button", { name: "Deactivate" });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/clinics/clinic-1/deactivate"));
  });
});
