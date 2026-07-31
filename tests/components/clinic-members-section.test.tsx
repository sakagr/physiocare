import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { ClinicMembersSection } from "@/features/user-clinics";
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

const roleFixture = { id: "role-physio", name: "ORG_PHYSIOTHERAPIST", display_name: "Physiotherapist", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
const priya = { id: "user-priya", organization_id: "org-1", full_name: "Priya Physio", email: "priya@example.test", username: "priya", phone: null, role_id: "role-physio", is_active: true, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", deleted_at: null, role: roleFixture };
const raj = { ...priya, id: "user-raj", full_name: "Raj Reception" };

function mockGet(assigned: typeof priya[]) {
  get.mockImplementation((path: string) => {
    if (path.includes("/api/clinics/")) return Promise.resolve(assigned);
    if (path.includes("/api/users")) {
      return Promise.resolve({ items: [priya, raj], total: 2, page: 1, pageSize: 200, totalPages: 1, assignableRoles: [] });
    }
    return Promise.resolve(undefined);
  });
}

/**
 * The clinic drawer's member list (M6): role-embedded (D10 ii), assign/remove
 * gated on `clinics:manage`.
 */
describe("ClinicMembersSection", () => {
  it("lists members with their role and offers only unassigned users in the picker, for an Owner", async () => {
    mockGet([priya]);
    renderWithProviders(<ClinicMembersSection clinicId="clinic-1" />, { currentUser: currentUserFixtures.owner() });

    expect(await screen.findByText("Priya Physio · Physiotherapist")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByPlaceholderText("Assign a user"));
    expect(await screen.findByRole("option", { name: /Raj Reception/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Priya Physio/ })).toBeNull();
  });

  it("shows an empty state with no members", async () => {
    mockGet([]);
    renderWithProviders(<ClinicMembersSection clinicId="clinic-1" />, { currentUser: currentUserFixtures.owner() });

    expect(await screen.findByText("No staff assigned yet.")).toBeInTheDocument();
  });

  it("assigns a user and invalidates the list", async () => {
    mockGet([]);
    post.mockResolvedValue({ id: "assignment-1" });
    const user = userEvent.setup();
    renderWithProviders(<ClinicMembersSection clinicId="clinic-1" />, { currentUser: currentUserFixtures.owner() });

    await screen.findByText("No staff assigned yet.");
    await user.click(screen.getByPlaceholderText("Assign a user"));
    await user.click(await screen.findByRole("option", { name: /Priya Physio/ }));
    await user.click(screen.getByRole("button", { name: "Assign" }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/user-clinics", { userId: "user-priya", clinicId: "clinic-1" }));
    expect(await screen.findByText("User assigned.")).toBeInTheDocument();
  });

  it("removes a member through the named confirm", async () => {
    mockGet([priya]);
    del.mockResolvedValue({});
    const user = userEvent.setup();
    renderWithProviders(<ClinicMembersSection clinicId="clinic-1" />, { currentUser: currentUserFixtures.owner() });

    await screen.findByText("Priya Physio · Physiotherapist");
    await user.click(screen.getByRole("button", { name: "Remove Priya Physio" }));
    expect(screen.getByText(/lose access to this clinic/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(del).toHaveBeenCalledWith("/api/user-clinics?userId=user-priya&clinicId=clinic-1"));
  });

  it("hides assign/remove controls for a receptionist", async () => {
    mockGet([priya]);
    renderWithProviders(<ClinicMembersSection clinicId="clinic-1" />, { currentUser: currentUserFixtures.receptionist() });

    await screen.findByText("Priya Physio · Physiotherapist");
    expect(screen.queryByPlaceholderText("Assign a user")).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove Priya Physio" })).toBeNull();
  });
});
