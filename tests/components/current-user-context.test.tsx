import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  CurrentUserProvider,
  useCan,
  useCurrentUser,
} from "@/lib/auth/current-user-context";
import { currentUserFixtures } from "../helpers/current-user";

/**
 * The client authorization seam: components gate on capability tokens from
 * `/me`, never on role names (AGENTS.md → Client Authorization). The gate is
 * advisory UX — the route handlers remain the security boundary.
 */
describe("current-user context", () => {
  function CapabilityProbe() {
    const user = useCurrentUser();
    const canManageUsers = useCan("users:manage");
    const canManageSubscription = useCan("subscription:manage");

    return (
      <div>
        <span data-testid="name">{user.fullName}</span>
        <span data-testid="role">{user.role.displayName}</span>
        <span data-testid="users">{String(canManageUsers)}</span>
        <span data-testid="subscription">{String(canManageSubscription)}</span>
      </div>
    );
  }

  it("exposes the user seeded by the server layout", () => {
    render(
      <CurrentUserProvider value={currentUserFixtures.owner()}>
        <CapabilityProbe />
      </CurrentUserProvider>
    );

    expect(screen.getByTestId("name")).toHaveTextContent("Test User");
    expect(screen.getByTestId("role")).toHaveTextContent("Owner");
  });

  it("grants a capability the user holds and denies one they do not", () => {
    render(
      <CurrentUserProvider value={currentUserFixtures.admin()}>
        <CapabilityProbe />
      </CurrentUserProvider>
    );

    // An administrator manages users but not the subscription (Owner-only).
    expect(screen.getByTestId("users")).toHaveTextContent("true");
    expect(screen.getByTestId("subscription")).toHaveTextContent("false");
  });

  it("denies every capability for a role that holds none", () => {
    render(
      <CurrentUserProvider value={currentUserFixtures.superAdmin()}>
        <CapabilityProbe />
      </CurrentUserProvider>
    );

    expect(screen.getByTestId("users")).toHaveTextContent("false");
    expect(screen.getByTestId("subscription")).toHaveTextContent("false");
  });

  it("fails loudly when used outside the provider", () => {
    // A missing provider would otherwise silently hide every gated action.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<CapabilityProbe />)).toThrow(
      /CurrentUserProvider/
    );

    consoleError.mockRestore();
  });
});
