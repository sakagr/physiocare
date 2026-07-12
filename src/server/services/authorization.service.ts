import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { AppRole } from "../repositories/user.repository";
import { findUserById, findRoleById } from "../repositories/user.repository";

/**
 * Centralized mapping of role management administrative capabilities.
 * Defines which roles are authorized to manage which target roles within the same organization.
 */
const ROLE_HIERARCHY: Record<AppRole, AppRole[]> = {
  SUPER_ADMIN: [], // Platform admin has full access bypass and doesn't participate in org hierarchy.
  PLATFORM_SUPPORT: [],
  PLATFORM_SALES: [],
  PLATFORM_BILLING: [],
  ORG_OWNER: [
    "ORG_OWNER",
    "ORG_ADMIN",
    "ORG_PHYSIOTHERAPIST",
    "ORG_RECEPTIONIST",
    "ORG_ACCOUNTANT",
  ],
  ORG_ADMIN: [
    "ORG_PHYSIOTHERAPIST",
    "ORG_RECEPTIONIST",
    "ORG_ACCOUNTANT",
  ],
  ORG_PHYSIOTHERAPIST: [],
  ORG_RECEPTIONIST: [],
  ORG_ACCOUNTANT: [],
};

/**
 * Helper to determine if a caller role can administer a target role based on the role hierarchy.
 */
export function canManageRole(callerRole: AppRole, targetRole: AppRole): boolean {
  const manageableRoles = ROLE_HIERARCHY[callerRole] || [];
  return manageableRoles.includes(targetRole);
}

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

  if (creatorRole === "SUPER_ADMIN") {
    return true;
  }

  if (creatorRole === "ORG_OWNER") {
    return targetRole.startsWith("ORG_");
  }

  if (creatorRole === "ORG_ADMIN") {
    return targetRole.startsWith("ORG_") && targetRole !== "ORG_OWNER" && targetRole !== "ORG_ADMIN";
  }

  return false;
}

/**
 * Checks if a caller has the general privilege to manage organization users.
 */
export async function canManageUsers(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  const caller = await findUserById(supabase, callerUserId);
  if (!caller) return false;
  const roleRecord = await findRoleById(supabase, caller.role_id);
  if (!roleRecord) return false;
  
  const roleName = roleRecord.name;
  return roleName === "ORG_OWNER" || roleName === "ORG_ADMIN" || roleName === "SUPER_ADMIN";
}

/**
 * Determines whether a caller can manage (update profile, deactivate, activate, off-board) a target user.
 */
export async function canManageTargetUser(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  targetUserId: string
): Promise<boolean> {
  const caller = await findUserById(supabase, callerUserId);
  const target = await findUserById(supabase, targetUserId);
  if (!caller || !target) return false;

  const callerRoleRecord = await findRoleById(supabase, caller.role_id);
  if (!callerRoleRecord) return false;

  // Platform SUPER_ADMIN has global override authority
  if (callerRoleRecord.name === "SUPER_ADMIN") {
    return true;
  }

  // Enforce same-organization scoping
  if (!caller.organization_id || caller.organization_id !== target.organization_id) {
    return false;
  }

  const targetRoleRecord = await findRoleById(supabase, target.role_id);
  if (!targetRoleRecord) return false;

  return canManageRole(callerRoleRecord.name, targetRoleRecord.name);
}

/**
 * Checks if a caller is authorized to change a user's role.
 */
export async function canUpdateUserRole(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  targetUserId: string,
  targetRole: AppRole
): Promise<boolean> {
  const canManageTarget = await canManageTargetUser(supabase, callerUserId, targetUserId);
  if (!canManageTarget) return false;

  const caller = await findUserById(supabase, callerUserId);
  if (!caller) return false;

  const callerRoleRecord = await findRoleById(supabase, caller.role_id);
  if (!callerRoleRecord) return false;

  if (callerRoleRecord.name === "SUPER_ADMIN") return true;

  // Caller must be authorized to assign the target role as well
  return canManageRole(callerRoleRecord.name, targetRole);
}

/**
 * Checks if a caller has write administration access over clinics.
 */
export async function canManageClinics(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  const caller = await findUserById(supabase, callerUserId);
  if (!caller) return false;
  const roleRecord = await findRoleById(supabase, caller.role_id);
  if (!roleRecord) return false;

  const roleName = roleRecord.name;
  return roleName === "ORG_OWNER" || roleName === "ORG_ADMIN" || roleName === "SUPER_ADMIN";
}

/**
 * Checks if a caller has read access over clinics.
 */
export async function canViewClinics(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  const caller = await findUserById(supabase, callerUserId);
  if (!caller) return false;
  
  // Any active organization employee or platform super admin can view clinics
  const roleRecord = await findRoleById(supabase, caller.role_id);
  const isSuperAdmin = roleRecord?.name === "SUPER_ADMIN";

  return !!caller.organization_id || isSuperAdmin;
}

/**
 * Checks if a caller is authorized to assign or remove clinic assignments.
 */
export async function canAssignUserToClinic(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return canManageClinics(supabase, callerUserId);
}

/**
 * Checks if a caller is authorized to view user clinic assignments.
 */
export async function canViewUserClinicAssignments(
  supabase: SupabaseClient<Database>,
  callerUserId: string
): Promise<boolean> {
  return canViewClinics(supabase, callerUserId);
}

/**
 * Resolves all clinic IDs accessible to the user.
 * - Platform admins (SUPER_ADMIN) and organization admins (ORG_OWNER, ORG_ADMIN) can access all clinics in the organization.
 * - Regular clinic employees are restricted to their explicitly assigned clinics.
 */
export async function getAccessibleClinicIds(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string[]> {
  const user = await findUserById(supabase, userId);
  if (!user) {
    return [];
  }

  const roleRecord = await findRoleById(supabase, user.role_id);
  if (!roleRecord) {
    return [];
  }

  const roleName = roleRecord.name;

  if (roleName === "SUPER_ADMIN") {
    const { data, error } = await supabase
      .from("clinics")
      .select("id")
      .is("deleted_at", null);
    if (error) throw error;
    return data.map((c) => c.id);
  }

  if (roleName === "ORG_OWNER" || roleName === "ORG_ADMIN") {
    if (!user.organization_id) return [];
    const { data, error } = await supabase
      .from("clinics")
      .select("id")
      .eq("organization_id", user.organization_id)
      .is("deleted_at", null);
    if (error) throw error;
    return data.map((c) => c.id);
  }

  // Non-managerial role: Query active assignments in user_clinics
  const { data, error } = await supabase
    .from("user_clinics")
    .select("clinic_id")
    .eq("user_id", userId)
    .is("deleted_at", null);
  if (error) throw error;
  return data.map((uc) => uc.clinic_id);
}
