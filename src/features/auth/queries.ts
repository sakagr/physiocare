import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { CurrentUser } from "@/types/contracts/me";

/**
 * Query factories for the auth feature. Every resource exposes its reads as
 * `queryOptions()` factories with stable keys, consumed identically by
 * `useQuery` and by a server prefetch — query keys are never inlined in
 * components (AGENTS.md → Rendering and Server State).
 */

export const authQueryKeys = {
  currentUser: ["auth", "me"] as const,
};

/**
 * The signed-in user's identity, role, capabilities, and clinics. The shell
 * seeds this from the server render, so it is usually read from the
 * current-user context rather than fetched again.
 */
export function currentUserQueryOptions() {
  return queryOptions({
    queryKey: authQueryKeys.currentUser,
    queryFn: () => api.get<CurrentUser>("/api/users/me"),
  });
}
