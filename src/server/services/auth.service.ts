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
