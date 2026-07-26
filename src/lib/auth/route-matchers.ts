/**
 * Path classification for the proxy (Next 16's name for middleware).
 *
 * The proxy refreshes the Supabase session and performs coarse redirects
 * only; per the Next docs it is for optimistic checks, not authorization.
 * The real gate is the route-group layout guard. These matchers live here,
 * apart from `src/proxy.ts`, so they can be unit-tested directly.
 */

/** Routes that require a signed-in user: the two application namespaces. */
const PROTECTED_PREFIXES = ["/app", "/platform"];

/** The shared front door — signed-in users are sent to their own home. */
const AUTH_ROUTES = ["/login", "/reset-password", "/invite"];

/** Session handoff; never redirected, it needs to complete its exchange. */
const AUTH_CALLBACK_PREFIX = "/auth";

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isProtectedRoute(pathname: string): boolean {
  return matchesPrefix(pathname, PROTECTED_PREFIXES);
}

export function isAuthRoute(pathname: string): boolean {
  return matchesPrefix(pathname, AUTH_ROUTES);
}

export function isAuthCallback(pathname: string): boolean {
  return matchesPrefix(pathname, [AUTH_CALLBACK_PREFIX]);
}
