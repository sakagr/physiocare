import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { User } from "../repositories/user.repository";

export interface CreateOrganizationAdminInput {
  authUserId: string;
  organizationId: string;
  fullName: string;
  email: string;
}

/**
 * Creates the initial administrator user profile for an organization.
 */
export async function createOrganizationAdmin(
  supabase: SupabaseClient<Database>,
  input: CreateOrganizationAdminInput
): Promise<User> {
  throw new Error("Not implemented");
}


