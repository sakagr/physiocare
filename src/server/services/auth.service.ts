import crypto from "crypto";
import type { SupabaseClient, User as AuthUser } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** Why an authentication attempt was refused, when it was. */
export type SignInRefusal = "invalid_credentials" | "user_banned";

/**
 * A refused sign-in is an expected outcome of the workflow, not a fault, and
 * Supabase already reports it through its own success/error contract. This is
 * the third-party exception to the project's "throw on failure" rule
 * (AGENTS.md → Result Types); the calling service turns a refusal into the
 * user-facing `AppError`.
 */
export type SignInResult =
  | { authenticated: true }
  | { authenticated: false; reason: SignInRefusal };

/**
 * Invites a user to the application.
 * 
 * @param adminClient - The service-role Supabase client.
 * @param email - The email of the user to invite.
 * @param redirectUrl - The optional URL to redirect to upon accepting the invitation.
 * @returns The invited authentication user.
 */
export async function inviteUser(
  adminClient: SupabaseClient<Database>,
  email: string,
  redirectUrl?: string
): Promise<AuthUser> {
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    redirectUrl ? { redirectTo: redirectUrl } : undefined
  );

  if (error) {
    throw error;
  }

  return data.user;
}

/**
 * Authenticates an identity against Supabase Auth. The client passed in owns
 * the resulting session — in a request that is the cookie-writing route
 * client, so the session is persisted for subsequent calls.
 *
 * @returns Whether the credentials were accepted.
 */
export async function signIn(
  client: SupabaseClient<Database>,
  email: string,
  password: string
): Promise<SignInResult> {
  const { error } = await client.auth.signInWithPassword({ email, password });

  if (!error) {
    return { authenticated: true };
  }

  // Supabase reports both cases with its own error contract rather than by
  // throwing, so they are mapped here and nowhere else.
  if (error.code === "invalid_credentials") {
    return { authenticated: false, reason: "invalid_credentials" };
  }
  if (error.code === "user_banned") {
    return { authenticated: false, reason: "user_banned" };
  }

  throw error;
}

/**
 * Verifies a password without disturbing the caller's own session.
 *
 * The check goes straight to the auth provider's token endpoint rather than
 * through a second Supabase client: a client would carry its own session
 * handling and a realtime connection this has no use for, and constructing
 * one is not portable across Node versions. Nothing here is persisted — the
 * token that comes back is revoked immediately, and only for itself, so the
 * session the caller is currently using is untouched.
 */
export async function verifyPassword(
  email: string,
  password: string
): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
  }

  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (response.status === 400) {
    return false;
  }

  if (!response.ok) {
    throw new Error(
      `Password verification failed with status ${response.status}`
    );
  }

  const { access_token: accessToken } = (await response.json()) as {
    access_token?: string;
  };

  if (accessToken) {
    // Best effort, and deliberately scoped to this token alone: a global
    // sign-out here would end the session the user is changing their password
    // from.
    await fetch(`${url}/auth/v1/logout?scope=local`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
    }).catch(() => undefined);
  }

  return true;
}

/**
 * Ends the session held by the given client.
 */
export async function signOut(client: SupabaseClient<Database>): Promise<void> {
  const { error } = await client.auth.signOut();

  if (error) {
    throw error;
  }
}

/**
 * Sends a password-recovery email for the given address.
 *
 * @param redirectUrl - Where the emailed link returns the user to.
 */
export async function sendPasswordResetEmail(
  client: SupabaseClient<Database>,
  email: string,
  redirectUrl: string
): Promise<void> {
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl,
  });

  if (error) {
    throw error;
  }
}

/**
 * Sets the password of the user the given client is authenticated as.
 */
export async function updatePassword(
  client: SupabaseClient<Database>,
  password: string
): Promise<void> {
  const { error } = await client.auth.updateUser({ password });

  if (error) {
    throw error;
  }
}

/**
 * Deletes an authentication user from Supabase Auth.
 * 
 * @param adminClient - The service-role Supabase client.
 * @param userId - The ID of the authentication user to delete.
 */
export async function deleteUser(
  adminClient: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) {
    throw error;
  }
}

/**
 * Disables an authentication user in Supabase Auth by setting a long ban duration.
 * 
 * @param adminClient - The service-role Supabase client.
 * @param userId - The ID of the authentication user.
 */
export async function setUserDisabled(
  adminClient: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: "876000h", // 100 years ban
  });

  if (error) {
    throw error;
  }
}

/**
 * Enables an authentication user in Supabase Auth by lifting any active ban.
 * 
 * @param adminClient - The service-role Supabase client.
 * @param userId - The ID of the authentication user.
 */
export async function setUserEnabled(
  adminClient: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: "none",
  });

  if (error) {
    throw error;
  }
}

/**
 * Sets a specific Auth user's password, on their behalf, without holding or
 * needing their session. Distinct from `updatePassword` above, which sets
 * the password of whichever user the given client is itself authenticated
 * as -- that primitive cannot express an admin resetting someone else's
 * password, since the admin client has no "current user" of its own.
 *
 * @param adminClient - The service-role Supabase client.
 * @param userId - The ID of the authentication user whose password to set.
 * @param password - The new password.
 */
export async function setUserPassword(
  adminClient: SupabaseClient<Database>,
  userId: string,
  password: string
): Promise<void> {
  const { error } = await adminClient.auth.admin.updateUserById(userId, { password });

  if (error) {
    throw error;
  }
}

/**
 * Creates a new authentication user in Supabase Auth.
 * 
 * @param adminClient - The service-role Supabase client.
 * @param email - The email of the user.
 * @param password - The password of the user.
 * @returns The created authentication user.
 */
export async function createAuthUser(
  adminClient: SupabaseClient<Database>,
  email: string,
  password?: string
): Promise<AuthUser> {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    throw error;
  }

  return data.user;
}

/**
 * Generates a cryptographically secure random initial password.
 * 
 * Requirements:
 * - Exactly 16 characters long.
 * - Contains at least one lowercase letter, one uppercase letter, one digit, and one special character.
 */
export function generateInitialPassword(): string {
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";

  // Ensure at least one character from each set
  const passwordChars = [
    lowercase[crypto.randomInt(lowercase.length)],
    uppercase[crypto.randomInt(uppercase.length)],
    numbers[crypto.randomInt(numbers.length)],
    symbols[crypto.randomInt(symbols.length)],
  ];

  const allChars = lowercase + uppercase + numbers + symbols;
  for (let i = 4; i < 16; i++) {
    passwordChars.push(allChars[crypto.randomInt(allChars.length)]);
  }

  // Shuffle the password characters using Fisher-Yates
  for (let i = passwordChars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    const temp = passwordChars[i];
    passwordChars[i] = passwordChars[j];
    passwordChars[j] = temp;
  }

  return passwordChars.join("");
}
