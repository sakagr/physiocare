import crypto from "crypto";
import type { SupabaseClient, User as AuthUser } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

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
