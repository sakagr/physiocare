/**
 * The password-setup ticket (ADR-0007).
 *
 * Setting a password normally requires the current one. The recovery and
 * invitation flows cannot ask for it — the user either forgot it or never had
 * one — so their proof is different: they clicked a link delivered to the
 * account's email address, and `/auth/callback` verified it moments ago.
 *
 * This ticket records that fact. It is an authorization statement about *how
 * a session was obtained*, deliberately outside the capability map, which
 * remains the vocabulary for what a role may do. It is issued by the callback
 * for the two flows below, required by the set-password route, and cleared as
 * soon as it is used.
 */

export const PASSWORD_SETUP_COOKIE = "pc_password_setup";

/** Short enough that an abandoned tab is not a standing invitation. */
export const PASSWORD_SETUP_TTL_SECONDS = 15 * 60;

/** The link types that may hand out a ticket. */
export type PasswordSetupFlow = "recovery" | "invite";

const FLOWS: readonly string[] = ["recovery", "invite"];

export function isPasswordSetupFlow(
  value: string | null | undefined
): value is PasswordSetupFlow {
  return typeof value === "string" && FLOWS.includes(value);
}

/**
 * Cookie attributes for the ticket. `httpOnly` keeps it away from scripts,
 * and `lax` keeps it attached when the emailed link navigates in.
 */
export function passwordSetupCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PASSWORD_SETUP_TTL_SECONDS,
  };
}

/** Where each flow's set-password screen lives. */
export const PASSWORD_SETUP_PATHS: Record<PasswordSetupFlow, string> = {
  recovery: "/reset-password/confirm",
  invite: "/invite",
};
