import { describe, expect, it, vi } from "vitest";
import { PlatformShell } from "@/components/shell/platform-shell";
import { renderWithProviders, screen } from "../helpers/render";
import { currentUserFixtures } from "../helpers/current-user";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/platform/admin",
}));

/**
 * The V1 platform surface is deliberately minimal: in-app API tooling and a
 * user menu, no operational console (UX.md → Platform Console).
 */
describe("PlatformShell", () => {
  it("renders no primary navigation", () => {
    renderWithProviders(<PlatformShell>console</PlatformShell>, {
      currentUser: currentUserFixtures.superAdmin(),
    });

    expect(screen.queryByRole("navigation", { name: "Primary" })).toBeNull();
  });

  it("keeps the user menu and the content region", () => {
    renderWithProviders(<PlatformShell>console</PlatformShell>, {
      currentUser: currentUserFixtures.superAdmin(),
    });

    expect(
      screen.getByRole("button", { name: "Open user menu" })
    ).toBeInTheDocument();
    expect(document.querySelector("#main-content")).toHaveTextContent("console");
  });

  it("shows no working context for a user with no organization", () => {
    renderWithProviders(<PlatformShell>console</PlatformShell>, {
      currentUser: currentUserFixtures.superAdmin(),
    });

    expect(screen.queryByTestId("working-context")).toBeNull();
  });
});
