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
const AUTH_ROUTES = ["/login", "/reset-password"];

/**
 * Front-door screens that are reached *holding* a session: the set-password
 * step of the recovery and invitation flows, which `/auth/callback` redirects
 * to once it has exchanged the emailed token for one.
 *
 * They are matched exactly and separately so the proxy leaves them alone in
 * both directions — bouncing a signed-in user off them would drop an invited
 * user into the app before any password was collected, and bouncing a
 * sessionless one to `/login` would replace the page's own "this link has
 * expired" explanation with a bare sign-in form.
 */
const SESSION_REQUIRED_AUTH_ROUTES = ["/reset-password/confirm", "/invite"];

/** Session handoff; never redirected, it needs to complete its exchange. */
const AUTH_CALLBACK_PREFIX = "/auth";

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function matchesExactly(pathname: string, routes: string[]): boolean {
  return routes.includes(pathname);
}

export function isProtectedRoute(pathname: string): boolean {
  return matchesPrefix(pathname, PROTECTED_PREFIXES);
}

export function isAuthRoute(pathname: string): boolean {
  return (
    matchesExactly(pathname, AUTH_ROUTES) &&
    !isSessionRequiredAuthRoute(pathname)
  );
}

export function isSessionRequiredAuthRoute(pathname: string): boolean {
  return matchesExactly(pathname, SESSION_REQUIRED_AUTH_ROUTES);
}

export function isAuthCallback(pathname: string): boolean {
  return matchesPrefix(pathname, [AUTH_CALLBACK_PREFIX]);
}
