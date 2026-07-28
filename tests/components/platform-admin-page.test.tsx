import { afterEach, describe, expect, it, vi } from "vitest";
import ApiExplorerPage from "@/app/(platform)/platform/admin/page";
import { renderWithProviders, screen } from "../helpers/render";
import { currentUserFixtures } from "../helpers/current-user";

vi.mock("@/lib/api/client", () => ({
  api: { get: vi.fn(() => new Promise(() => {})) },
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

/**
 * The platform layout guard (`guardNamespace`) only checks group -- it admits
 * every platform role, including `PLATFORM_SUPPORT` / `SALES` / `BILLING`,
 * none of which have any UI in V1 (UX.md). The API Explorer is SUPER_ADMIN
 * only, so the page itself gates on the `platformApi:explore` capability via
 * the existing `<Can>` primitive, falling back to `ForbiddenState` in place
 * rather than a redirect -- redirecting a platform-group user out of
 * `/platform/admin` would send them right back to it (`resolveLanding`
 * returns `/platform/admin` for the whole platform group).
 */
describe("API explorer page", () => {
  it("renders the destination for a super admin", () => {
    renderWithProviders(<ApiExplorerPage />, {
      currentUser: currentUserFixtures.superAdmin(),
    });

    expect(screen.getByText("API explorer")).toBeInTheDocument();
  });

  it("shows the forbidden state for a platform role without the capability", () => {
    renderWithProviders(<ApiExplorerPage />, {
      currentUser: currentUserFixtures.platformSupport(),
    });

    expect(screen.queryByText("API explorer")).toBeNull();
    expect(
      screen.getByText("You don't have permission to view this")
    ).toBeInTheDocument();
  });

  /**
   * Env is checked before the capability check (ADR-0009), same ordering as
   * the spec endpoint: a disabled environment must 404 regardless of role,
   * so production never reveals via a rendered `ForbiddenState` that a
   * gated destination exists here at all.
   */
  it("404s in production even for a super admin, before the capability check runs", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() =>
      renderWithProviders(<ApiExplorerPage />, {
        currentUser: currentUserFixtures.superAdmin(),
      })
    ).toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });
});
