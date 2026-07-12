import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { AppRole } from "../repositories/user.repository";
import { findUserById, findRoleById } from "../repositories/user.repository";

/**
 * Verifies if a user has a specific application role.
 */
export async function hasRole(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: AppRole
): Promise<boolean> {
  const user = await findUserById(supabase, userId);
  if (!user) {
    return false;
  }
  const roleRecord = await findRoleById(supabase, user.role_id);
  if (!roleRecord) {
    return false;
  }
  return roleRecord.name === role;
}

/**
 * Verifies if a user is authorized to bootstrap/create an organization.
 */
export async function canBootstrapOrganization(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<boolean> {
  return hasRole(supabase, userId, "SUPER_ADMIN");
}

/**
 * Verifies if a user is authorized to create a new user with a specific target role.
 * 
 * Rules:
 * - Creator must exist and have a non-null organization_id.
 * - ORG_OWNER can create any role starting with "ORG_" (including ORG_OWNER and ORG_ADMIN).
 * - ORG_ADMIN can create any role starting with "ORG_" except ORG_OWNER and ORG_ADMIN.
 * - Any other role returns false.
 */
export async function canCreateUser(
  supabase: SupabaseClient<Database>,
  creatorUserId: string,
  targetRole: AppRole
): Promise<boolean> {
  const creator = await findUserById(supabase, creatorUserId);
  if (!creator || !creator.organization_id) {
    return false;
  }

  const roleRecord = await findRoleById(supabase, creator.role_id);
  if (!roleRecord) {
    return false;
  }

  const creatorRole = roleRecord.name;

  if (creatorRole === "ORG_OWNER") {
    return targetRole.startsWith("ORG_");
  }

  if (creatorRole === "ORG_ADMIN") {
    return targetRole.startsWith("ORG_") && targetRole !== "ORG_OWNER" && targetRole !== "ORG_ADMIN";
  }

  return false;
}
