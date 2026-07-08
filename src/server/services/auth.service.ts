import type { SupabaseClient, User as AuthUser } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Creates a new authentication user in Supabase Auth.
 * This operation requires a service-role admin client.
 * 
 * @param adminClient - The service-role Supabase client.
 * @param email - The email of the new user.
 * @returns The created Auth user.
 */
export async function createAuthUser(
  adminClient: SupabaseClient<Database>,
  email: string
): Promise<AuthUser> {
  throw new Error("Not implemented");
}


