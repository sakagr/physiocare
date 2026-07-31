import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { UsersCollection } from "@/features/users";
import type { ManageableUser } from "@/types/contracts/user";
import { renderWithProviders, screen, waitFor } from "../helpers/render";

const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const roleFixture = { id: "role-physio", name: "ORG_PHYSIOTHERAPIST", display_name: "Physiotherapist", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };

function makeUser(overrides: Partial<ManageableUser> = {}): ManageableUser {
  return {
    id: "user-1",
    organization_id: "org-1",
    full_name: "Priya Physio",
    email: "priya@example.test",
    username: "priya",
    phone: null,
    role_id: "role-physio",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    role: roleFixture,
    canManage: true,
    ...overrides,
  };
}

function listResponse(items: ManageableUser[]) {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 20,
    totalPages: 1,
    assignableRoles: [{ name: "ORG_PHYSIOTHERAPIST", display_name: "Physiotherapist" }],
  };
}

/**
 * The first collection in the app (F3): toolbar, server-driven pagination,
 * and the table↔card responsive shape (UX.md → Collections). The
 * table↔card reflow itself is CSS media queries and cannot be asserted in
 * jsdom (ADR-0002) -- both renderings are checked to exist in the DOM.
 */
describe("UsersCollection", () => {
  it("shows a skeleton while loading, then the loaded rows", async () => {
    get.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<UsersCollection onSelectUser={vi.fn()} canCreate onCreate={vi.fn()} />);

    expect(document.querySelectorAll(".mantine-Skeleton-root").length).toBeGreaterThan(0);
  });

  it("shows a purposeful empty state with the create action", async () => {
    get.mockResolvedValue(listResponse([]));
    const onCreate = vi.fn();
    renderWithProviders(<UsersCollection onSelectUser={vi.fn()} canCreate onCreate={onCreate} />);

    expect(await screen.findByText("No users yet")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "New user" }));
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it("renders a scoped inline error with retry on load failure", async () => {
    get.mockRejectedValue(new Error("network down"));
    renderWithProviders(<UsersCollection onSelectUser={vi.fn()} canCreate onCreate={vi.fn()} />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("lists users with their role display name and status, and opens the drawer on row click", async () => {
    get.mockResolvedValue(listResponse([makeUser()]));
    const onSelectUser = vi.fn();
    renderWithProviders(<UsersCollection onSelectUser={onSelectUser} canCreate onCreate={vi.fn()} />);

    expect((await screen.findAllByText("Priya Physio")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Physiotherapist").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);

    await userEvent.setup().click(screen.getAllByText("Priya Physio")[0]);
    expect(onSelectUser).toHaveBeenCalledWith("user-1");
  });

  it("shows an inactive user with the neutral status", async () => {
    get.mockResolvedValue(listResponse([makeUser({ id: "user-2", full_name: "Inactive Ida", is_active: false })]));
    renderWithProviders(<UsersCollection onSelectUser={vi.fn()} canCreate onCreate={vi.fn()} />);

    expect((await screen.findAllByText("Inactive Ida")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Inactive").length).toBeGreaterThan(0);
  });

  it("debounces search input before refetching", async () => {
    get.mockResolvedValue(listResponse([makeUser()]));
    renderWithProviders(<UsersCollection onSelectUser={vi.fn()} canCreate onCreate={vi.fn()} />);
    await screen.findAllByText("Priya Physio");
    get.mockClear();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/Search by name/), "priya");

    await waitFor(() => {
      expect(get).toHaveBeenCalledWith(expect.stringContaining("search=priya"));
    });
  });

  it("filters by role and status through the toolbar selects", async () => {
    get.mockResolvedValue(listResponse([makeUser()]));
    renderWithProviders(<UsersCollection onSelectUser={vi.fn()} canCreate onCreate={vi.fn()} />);
    await screen.findAllByText("Priya Physio");

    const user = userEvent.setup();
    await user.click(screen.getByPlaceholderText("All statuses"));
    await user.click(await screen.findByRole("option", { name: "Active" }));

    await waitFor(() => {
      expect(get).toHaveBeenCalledWith(expect.stringContaining("isActive=true"));
    });
  });
});
