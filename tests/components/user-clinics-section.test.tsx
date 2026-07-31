import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { UserClinicsSection } from "@/features/user-clinics";
import { currentUserFixtures } from "../helpers/current-user";
import { renderWithProviders, screen, waitFor } from "../helpers/render";

const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
const del = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    patch: vi.fn(),
    delete: (...args: unknown[]) => del(...args),
  },
}));

const northClinic = { id: "clinic-north", organization_id: "org-1", clinic_name: "North Clinic", email: null, phone: null, address: null, city: null, state: null, pincode: null, gst_number: null, is_active: true, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", deleted_at: null };
const southClinic = { ...northClinic, id: "clinic-south", clinic_name: "South Clinic" };

function mockGet(assigned: typeof northClinic[]) {
  get.mockImplementation((path: string) => {
    if (path.includes("/api/users/")) return Promise.resolve(assigned);
    if (path.includes("/api/clinics")) {
      return Promise.resolve({ items: [northClinic, southClinic], total: 2, page: 1, pageSize: 200, totalPages: 1 });
    }
    return Promise.resolve(undefined);
  });
}

/**
 * The user drawer's clinic list (M6): assign/remove gated on `clinics:manage`
 * -- matching `canAssignUserToClinic`'s actual predicate (= `canManageClinics`).
 */
describe("UserClinicsSection", () => {
  it("lists assigned clinics and offers only unassigned ones in the picker, for an Owner", async () => {
    mockGet([northClinic]);
    renderWithProviders(<UserClinicsSection userId="user-1" />, { currentUser: currentUserFixtures.owner() });

    expect(await screen.findByText("North Clinic")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByPlaceholderText("Assign to a clinic"));
    expect(await screen.findByRole("option", { name: "South Clinic" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "North Clinic" })).toBeNull();
  });

  it("shows an empty state with no assignments", async () => {
    mockGet([]);
    renderWithProviders(<UserClinicsSection userId="user-1" />, { currentUser: currentUserFixtures.owner() });

    expect(await screen.findByText("Not assigned to any clinic yet.")).toBeInTheDocument();
  });

  it("assigns a clinic and invalidates the list", async () => {
    mockGet([]);
    post.mockResolvedValue({ id: "assignment-1", organization_id: "org-1", user_id: "user-1", clinic_id: "clinic-north", assigned_at: "2026-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", deleted_at: null });
    const user = userEvent.setup();
    renderWithProviders(<UserClinicsSection userId="user-1" />, { currentUser: currentUserFixtures.owner() });

    await screen.findByText("Not assigned to any clinic yet.");
    await user.click(screen.getByPlaceholderText("Assign to a clinic"));
    await user.click(await screen.findByRole("option", { name: "North Clinic" }));
    await user.click(screen.getByRole("button", { name: "Assign" }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/user-clinics", { userId: "user-1", clinicId: "clinic-north" }));
    expect(await screen.findByText("Clinic assigned.")).toBeInTheDocument();
  });

  it("removes an assignment through the named confirm", async () => {
    mockGet([northClinic]);
    del.mockResolvedValue({});
    const user = userEvent.setup();
    renderWithProviders(<UserClinicsSection userId="user-1" />, { currentUser: currentUserFixtures.owner() });

    await screen.findByText("North Clinic");
    await user.click(screen.getByRole("button", { name: "Remove North Clinic" }));
    expect(screen.getByText(/lose access to this clinic/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(del).toHaveBeenCalledWith("/api/user-clinics?userId=user-1&clinicId=clinic-north"));
  });

  it("hides assign/remove controls for a physiotherapist", async () => {
    mockGet([northClinic]);
    renderWithProviders(<UserClinicsSection userId="user-1" />, { currentUser: currentUserFixtures.physiotherapist() });

    await screen.findByText("North Clinic");
    expect(screen.queryByPlaceholderText("Assign to a clinic")).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove North Clinic" })).toBeNull();
  });
});
