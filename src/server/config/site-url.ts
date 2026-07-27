/**
 * The application's own public base URL, used to build the absolute redirect
 * targets Supabase Auth sends users back to (invitation and password-recovery
 * links).
 *
 * It is configuration rather than a request-derived value so that a link
 * generated from a background workflow points at the same origin as one
 * generated from a browser request. The value must be allow-listed in the
 * Supabase project's redirect URLs.
 */
export function getSiteUrl(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!siteUrl) {
    throw new Error("Missing NEXT_PUBLIC_SITE_URL");
  }

  return siteUrl.replace(/\/$/, "");
}

/** The absolute session-handoff URL Supabase Auth redirects back to. */
export function getAuthCallbackUrl(next?: string): string {
  const callbackUrl = `${getSiteUrl()}/auth/callback`;

  return next ? `${callbackUrl}?next=${encodeURIComponent(next)}` : callbackUrl;
}
