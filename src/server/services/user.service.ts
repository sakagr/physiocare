import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { User } from "../repositories/user.repository";
import { findRoleByName, insertUser } from "../repositories/user.repository";

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
  const role = await findRoleByName(supabase, "ORG_ADMIN");
  if (!role) {
    throw new Error("ORG_ADMIN role does not exist");
  }

  const user = await insertUser(supabase, {
    id: input.authUserId,
    organization_id: input.organizationId,
    full_name: input.fullName,
    email: input.email,
    role_id: role.id,
  });

  return user;
}


