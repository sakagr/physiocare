import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { AppRole } from "../repositories/user.repository";

/**
 * Verifies if a user has a specific application role.
 */
export async function hasRole(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: AppRole
): Promise<boolean> {
  throw new Error("Not implemented");
}
