import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { UserMenu } from "@/components/shell/user-menu";
import { renderWithProviders, screen, waitFor } from "../helpers/render";
import { currentUserFixtures } from "../helpers/current-user";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const post = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/app",
}));

vi.mock("@/lib/api/client", () => ({
  api: { post: (...args: unknown[]) => post(...args) },
}));

/**
 * The user menu carries identity and the working context that the top bar
 * drops on narrow widths, so nothing is lost — only relocated
 * (UX.md → Working context & user menu).
 */
describe("UserMenu", () => {
  async function openMenu() {
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open user menu" }));
    return user;
  }

  it("names the user by their role's display name, never a system code", async () => {
    renderWithProviders(<UserMenu />, {
      currentUser: currentUserFixtures.physiotherapist(),
    });
    await openMenu();

    expect(screen.getAllByText("Physiotherapist").length).toBeGreaterThan(0);
    expect(screen.queryByText("ORG_PHYSIOTHERAPIST")).toBeNull();
  });

  it("keeps the organization discoverable inside the menu", async () => {
    renderWithProviders(<UserMenu />);
    await openMenu();

    expect(screen.getByText("Test Organization")).toBeInTheDocument();
  });

  it("offers the clinics the user may work in", async () => {
    renderWithProviders(<UserMenu />);
    await openMenu();

    // The current clinic reads as the field's value, so the menu keeps a
    // fixed height however many clinics exist.
    expect(screen.getByRole("combobox", { name: "Clinic" })).toHaveValue(
      "North Clinic"
    );
  });

  it("persists a clinic choice for the next server render", async () => {
    renderWithProviders(<UserMenu />);
    const user = await openMenu();

    await user.click(screen.getByRole("combobox", { name: "Clinic" }));
    await user.click(screen.getByRole("option", { name: "South Clinic" }));

    expect(screen.getByRole("combobox", { name: "Clinic" })).toHaveValue(
      "South Clinic"
    );
    expect(document.cookie).toContain("pc-current-clinic=clinic-south");
  });

  it("hides the clinic field when the user has no clinics", async () => {
    renderWithProviders(<UserMenu />, {
      currentUser: currentUserFixtures.superAdmin(),
    });
    await openMenu();

    expect(screen.queryByRole("combobox", { name: "Clinic" })).toBeNull();
  });

  it("opens the account surfaces the menu offers", async () => {
    renderWithProviders(<UserMenu />);
    const user = await openMenu();

    await user.click(screen.getByRole("menuitem", { name: "My account" }));

    expect(screen.getByRole("heading", { name: "My account" })).toBeInTheDocument();
    // Identity comes from the current-user contract the shell already holds.
    expect(screen.getByText("test.user@example.test")).toBeInTheDocument();
  });

  it("raises the change-password dialog from the menu", async () => {
    renderWithProviders(<UserMenu />);
    const user = await openMenu();

    await user.click(screen.getByRole("menuitem", { name: "Change password" }));

    expect(
      screen.getByRole("heading", { name: "Change password" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
  });

  it("signs the user out through the API and returns them to the front door", async () => {
    renderWithProviders(<UserMenu />);
    const user = await openMenu();

    await user.click(screen.getByRole("menuitem", { name: "Log out" }));

    // Through `/api`, not straight to Supabase: the route clears the session
    // cookies the server set (AGENTS.md → Backend Communication).
    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/auth/logout"));
    expect(router.push).toHaveBeenCalledWith("/login");
  });
});
