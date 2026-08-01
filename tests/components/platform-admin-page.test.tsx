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
 * The platform layout guard (`guardNamespace`) only checks group.
 * `SUPER_ADMIN` is the only platform-group role in V1 (the former
 * `PLATFORM_SUPPORT`/`SALES`/`BILLING` roles were removed -- see AGENTS.md's
 * Project Decisions), so the page's `<Can>` gate on `platformApi:explore`
 * has no reachable negative branch through a real role today; it stays in
 * place as the same mechanism every other capability gate in the app uses,
 * falling back to `ForbiddenState` rather than a redirect -- redirecting a
 * platform-group user out of `/platform/admin` would send them right back
 * to it (`resolveLanding` returns `/platform/admin` for the whole platform
 * group).
 */
describe("API explorer page", () => {
  it("renders the destination for a super admin", () => {
    renderWithProviders(<ApiExplorerPage />, {
      currentUser: currentUserFixtures.superAdmin(),
    });

    expect(screen.getByText("API explorer")).toBeInTheDocument();
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
