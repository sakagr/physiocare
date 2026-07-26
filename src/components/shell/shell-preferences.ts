/**
 * Shell preferences that affect the server-rendered output.
 *
 * These persist in cookies, not `localStorage`, so the server render already
 * knows the user's choice and the shell paints in its correct state instead
 * of rendering the default and correcting itself after hydration
 * (AGENTS.md → Rendering and Server State).
 */

export const NAV_COLLAPSED_COOKIE = "pc-nav-collapsed";
export const CURRENT_CLINIC_COOKIE = "pc-current-clinic";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Writes a preference from the browser. No-op during a server render. */
export function writeShellPreference(name: string, value: string): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}
