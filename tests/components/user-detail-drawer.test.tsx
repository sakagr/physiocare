import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { UserDetailDrawer } from "@/features/users";
import type { ManageableUser } from "@/types/contracts/user";
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

const roleFixture = { id: "role-admin", name: "ORG_ADMIN", display_name: "Administrator", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };

function makeUser(overrides: Partial<ManageableUser> = {}): ManageableUser {
  return {
    id: "user-admin-1",
    organization_id: "org-1",
    full_name: "Ada Admin",
    email: "ada@example.test",
    username: "ada",
    phone: "9876543210",
    role_id: "role-admin",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    role: roleFixture,
    canManage: true,
    ...overrides,
  };
}

const roleOptions = [{ name: "ORG_PHYSIOTHERAPIST", display_name: "Physiotherapist" }];

/** Routes the shared `get` mock by path, for the drawer plus its compensation and M6 clinic-list sections. */
function mockGet(user: ManageableUser) {
  get.mockImplementation((path: string) => {
    if (path.includes("/compensation")) return Promise.resolve([]);
    if (path.includes("/api/users/") && path.includes("/clinics")) return Promise.resolve([]);
    if (path.includes("/api/clinics")) {
      return Promise.resolve({ items: [], total: 0, page: 1, pageSize: 200, totalPages: 0 });
    }
    return Promise.resolve(user);
  });
}

/**
 * User detail & compensation (UX.md screen inventory). Row actions are
 * gated on the server-computed `canManage` hint (ADR-0010); compensation is
 * gated separately on the `compensation:view` capability (D1) -- proven here
 * by swapping the fixture, never by mocking a hook.
 */
describe("UserDetailDrawer", () => {
  it("shows manage actions and the compensation section for an Owner viewing a manageable user", async () => {
    mockGet(makeUser());

    renderWithProviders(
      <UserDetailDrawer userId="user-admin-1" onClose={vi.fn()} roleOptions={roleOptions} />,
      { currentUser: currentUserFixtures.owner() }
    );

    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change role" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset password" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Off-board" })).toBeInTheDocument();
    expect(screen.getByText("Compensation")).toBeInTheDocument();
  });

  it("hides manage actions and the compensation section for an Admin viewing a row they cannot manage", async () => {
    mockGet(makeUser({ canManage: false }));

    renderWithProviders(
      <UserDetailDrawer userId="user-admin-1" onClose={vi.fn()} roleOptions={roleOptions} />,
      { currentUser: currentUserFixtures.admin() }
    );

    await screen.findByText("Ada Admin");
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Off-board" })).toBeNull();
    expect(screen.queryByText("Compensation")).toBeNull();
  });

  it("requires the terminal confirm before off-boarding, with no undo offered", async () => {
    mockGet(makeUser());
    del.mockResolvedValue(makeUser({ is_active: false, deleted_at: "2026-07-31T00:00:00.000Z" }));
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <UserDetailDrawer userId="user-admin-1" onClose={onClose} roleOptions={roleOptions} />,
      { currentUser: currentUserFixtures.owner() }
    );

    await user.click(await screen.findByRole("button", { name: "Off-board" }));
    expect(screen.getByText(/terminal/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();

    // Two "Off-board" buttons now exist: the drawer's trigger and the
    // ConfirmDialog's own confirm button (which carries the action's verb).
    const offboardButtons = screen.getAllByRole("button", { name: "Off-board" });
    await user.click(offboardButtons[offboardButtons.length - 1]);

    await waitFor(() => expect(del).toHaveBeenCalledWith("/api/users/user-admin-1"));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it("opens the reset-password confirm and reveals the new password once resolved", async () => {
    mockGet(makeUser());
    post.mockResolvedValue({ userId: "user-admin-1", username: "ada", initialPassword: "Zx8@qWe1rTy2ui3" });
    const user = userEvent.setup();

    renderWithProviders(
      <UserDetailDrawer userId="user-admin-1" onClose={vi.fn()} roleOptions={roleOptions} />,
      { currentUser: currentUserFixtures.owner() }
    );

    await user.click(await screen.findByRole("button", { name: "Reset password" }));
    const resetButtons = screen.getAllByRole("button", { name: "Reset password" });
    await user.click(resetButtons[resetButtons.length - 1]);

    expect(await screen.findByText("Password reset")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toHaveValue("Zx8@qWe1rTy2ui3");
  });
});
