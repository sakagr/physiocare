import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { AppError, ErrorCodes } from "../errors";
import { getAuthCallbackUrl } from "../config/site-url";
import { findUserByUsername } from "../repositories/user.repository";
import {
  sendPasswordResetEmail,
  signIn,
  signOut,
  updatePassword,
  verifyPassword,
} from "./auth.service";
import {
  validateChangePasswordInput,
  validateLoginInput,
  validateRequestPasswordResetInput,
  validateSetPasswordInput,
} from "../validators/auth.validator";

/**
 * The session workflows: signing in, signing out, and the three ways a
 * password changes. Each spans the Authentication subsystem and the User
 * domain, so they are orchestrated here rather than inside either one
 * (AGENTS.md → Application (Orchestration) Services).
 *
 * Two Supabase clients are involved and are not interchangeable:
 *
 * - `adminClient` resolves the application user. Username lookup happens
 *   before there is a session, and the `users` RLS policy only admits
 *   authenticated callers, so it cannot be done with the caller's own client.
 * - `authClient` holds the session. In a request that is the cookie-writing
 *   route client, so a successful sign-in is persisted to the browser.
 */

/**
 * Authenticates a user by username and password.
 *
 * Every refusal answers with the same error, so the endpoint cannot be used
 * to discover which usernames exist.
 */
export async function authenticate(
  adminClient: SupabaseClient<Database>,
  authClient: SupabaseClient<Database>,
  input: unknown
): Promise<void> {
  const { username, password } = validateLoginInput(input);

  const user = await findUserByUsername(adminClient, username);
  if (!user) {
    throw new AppError(
      "We couldn't sign you in. Check your username and password.",
      ErrorCodes.INVALID_CREDENTIALS
    );
  }

  const result = await signIn(authClient, user.email, password);

  if (!result.authenticated) {
    if (result.reason === "user_banned") {
      throw new AppError(
        "This account is no longer active. Contact your administrator.",
        ErrorCodes.ACCOUNT_INACTIVE
      );
    }

    throw new AppError(
      "We couldn't sign you in. Check your username and password.",
      ErrorCodes.INVALID_CREDENTIALS
    );
  }

  // The credentials were valid, so a session now exists. A profile that has
  // been deactivated or off-boarded without a corresponding Auth ban must not
  // keep it.
  if (!user.is_active || user.deleted_at) {
    await signOut(authClient);
    throw new AppError(
      "This account is no longer active. Contact your administrator.",
      ErrorCodes.ACCOUNT_INACTIVE
    );
  }
}

/**
 * Ends the caller's session. Signing out when no session exists is a no-op,
 * so the operation is safe to repeat.
 */
export async function endSession(
  authClient: SupabaseClient<Database>
): Promise<void> {
  await signOut(authClient);
}

/**
 * Sends a password-recovery link for the account behind a username.
 *
 * The workflow is uniform for every role and reports nothing about the
 * identifier it was given: an unknown username, an inactive account, and a
 * delivered email are indistinguishable to the caller. Roles whose email is a
 * placeholder are steered to their administrator by the screen's copy, not by
 * a rule here (UX.md → Flow 2).
 */
export async function requestPasswordReset(
  adminClient: SupabaseClient<Database>,
  authClient: SupabaseClient<Database>,
  input: unknown
): Promise<void> {
  const { username } = validateRequestPasswordResetInput(input);

  const user = await findUserByUsername(adminClient, username);

  if (!user || !user.is_active || user.deleted_at) {
    return;
  }

  await sendPasswordResetEmail(authClient, user.email, getAuthCallbackUrl());
}

/**
 * Sets the password of the user holding a recovery or invitation session.
 *
 * The caller is responsible for proving the session came from an emailed
 * link (the password-setup ticket, ADR-0007) before this is reached — no
 * current password is required here.
 */
export async function setPassword(
  authClient: SupabaseClient<Database>,
  input: unknown
): Promise<void> {
  const { newPassword } = validateSetPasswordInput(input);

  await updatePassword(authClient, newPassword);
}

/**
 * Changes the password of an authenticated user who knows their current one.
 *
 * Re-entering the current password is an application-level requirement rather
 * than a Supabase one: it is what stops an unattended, unlocked workstation
 * being used to take an account over.
 */
export async function changePassword(
  authClient: SupabaseClient<Database>,
  email: string,
  input: unknown
): Promise<void> {
  const { currentPassword, newPassword } = validateChangePasswordInput(input);

  const verified = await verifyPassword(email, currentPassword);
  if (!verified) {
    throw new AppError(
      "That current password isn't right.",
      ErrorCodes.INVALID_CURRENT_PASSWORD
    );
  }

  await updatePassword(authClient, newPassword);
}
