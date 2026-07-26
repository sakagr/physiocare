import type { CurrentUser, UserGroup } from "@/types/contracts/me";

/**
 * Where a user belongs, as pure functions over the current-user contract.
 *
 * Landing resolution is not a screen: it runs after authentication and routes
 * the user to their home, keeping sign-in role-agnostic (UX.md → Landing
 * resolution). The namespace guard is its mirror — it decides whether a user
 * may be in the namespace they have reached, and where to send them if not.
 *
 * Keeping both free of Next, Supabase, and cookies means the entire redirect
 * matrix is unit-tested against fixtures; the route-group `layout.tsx` files
 * are the only place that turns an answer into a `redirect()`.
 */

export const LOGIN_PATH = "/login";
export const ORG_HOME_PATH = "/app";
export const PLATFORM_HOME_PATH = "/platform/admin";

/** The home path for a signed-in user, or the login page for a visitor. */
export function resolveLanding(user: CurrentUser | null): string {
  if (!user) {
    return LOGIN_PATH;
  }

  return user.group === "platform" ? PLATFORM_HOME_PATH : ORG_HOME_PATH;
}

/**
 * Returns where to send a user who has reached the given namespace, or `null`
 * when they belong there. Wrong-namespace access is bounced to the user's own
 * home rather than to a dead end.
 */
export function guardNamespace(
  namespace: UserGroup,
  user: CurrentUser | null
): string | null {
  if (!user) {
    return LOGIN_PATH;
  }

  return user.group === namespace ? null : resolveLanding(user);
}
