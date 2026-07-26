"use client";

import { createContext, useContext, useMemo } from "react";
import type { Capability, CurrentUser } from "@/types/contracts/me";

/**
 * The client-side identity seam. The route-group layout already resolves the
 * current user server-side to enforce its guard, so it seeds this context
 * with that result — no second round-trip, and no loading flash before the
 * shell knows who it is rendering for.
 *
 * Every capability gate in the app reads from here: the primary navigation,
 * and the `useCan()` / `<Can>` pair. Components gate on capability tokens,
 * never on role names (AGENTS.md → Client Authorization). This is advisory
 * UX only; the route handlers' `withCapability` checks remain the security
 * boundary.
 *
 * It lives in `src/lib/auth/` rather than in a feature because
 * `src/components/ui/can.tsx` depends on it: a shared primitive must depend
 * downward on shared infrastructure, never sideways on a feature. Its server
 * counterpart, `current-user.server.ts`, sits beside it.
 */

interface CurrentUserContextValue {
  user: CurrentUser;
  capabilities: ReadonlySet<Capability>;
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export function CurrentUserProvider({
  value,
  children,
}: {
  value: CurrentUser;
  children: React.ReactNode;
}) {
  const contextValue = useMemo<CurrentUserContextValue>(
    () => ({ user: value, capabilities: new Set(value.capabilities) }),
    [value]
  );

  return (
    <CurrentUserContext value={contextValue}>{children}</CurrentUserContext>
  );
}

function useCurrentUserContext(): CurrentUserContextValue {
  const context = useContext(CurrentUserContext);

  if (!context) {
    throw new Error(
      "useCurrentUser must be used within a CurrentUserProvider. The route-group layout mounts it."
    );
  }

  return context;
}

/** The signed-in user's identity, role, organization, and clinics. */
export function useCurrentUser(): CurrentUser {
  return useCurrentUserContext().user;
}

/**
 * Whether the user holds a capability. Use this to hide or disable an action
 * rather than showing it and letting the request fail (UX.md → State model,
 * "Restricted").
 */
export function useCan(capability: Capability): boolean {
  return useCurrentUserContext().capabilities.has(capability);
}
