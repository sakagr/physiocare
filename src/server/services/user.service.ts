import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { User, AppRole, Role } from "../repositories/user.repository";
import {
  findRoleByName,
  insertUser,
  findUserByUsername,
  findUserByEmail,
  findUserById,
  findRoleById,
  listUsers,
  countUsers,
  findUserWithRoleById,
} from "../repositories/user.repository";
import { AppError, ErrorCodes } from "../errors";
import type { PagedResult } from "../validators/shared.validator";
import { canManageUsers, canManageTargetUser, canManageRole, getAssignableRoles, hasRole } from "./authorization.service";

export interface CreateOrganizationOwnerInput {
  authUserId: string;
  organizationId: string;
  fullName: string;
  email: string;
  username: string;
}

/**
 * Creates the initial owner user profile for an organization.
 */
export async function createOrganizationOwner(
  supabase: SupabaseClient<Database>,
  input: CreateOrganizationOwnerInput
): Promise<User> {
  const role = await findRoleByName(supabase, "ORG_OWNER");
  if (!role) {
    throw new Error("ORG_OWNER role does not exist");
  }

  const user = await insertUser(supabase, {
    id: input.authUserId,
    organization_id: input.organizationId,
    full_name: input.fullName,
    email: input.email,
    role_id: role.id,
    username: input.username,
  });

  return user;
}

/**
 * Ensures that the provided username is unique and available.
 * Throws an AppError if the username is already in use.
 */
export async function ensureUsernameAvailable(
  supabase: SupabaseClient<Database>,
  username: string
): Promise<void> {
  const existingUser = await findUserByUsername(supabase, username);
  if (existingUser) {
    throw new AppError(
      `Username "${username}" already exists`,
      ErrorCodes.USERNAME_ALREADY_EXISTS
    );
  }
}

/**
 * Ensures that the provided email address is unique and available globally.
 * Throws an AppError if the email is already in use (by active, deactivated, or off-boarded users).
 */
export async function ensureEmailAvailable(
  supabase: SupabaseClient<Database>,
  email: string
): Promise<void> {
  const existingUser = await findUserByEmail(supabase, email);
  if (existingUser) {
    throw new AppError(
      `Email address "${email}" is already registered`,
      ErrorCodes.EMAIL_ALREADY_EXISTS
    );
  }
}

export interface CreateOrganizationUserProfileInput {
  authUserId: string;
  organizationId: string;
  fullName: string;
  email: string;
  username: string;
  roleName: AppRole;
  phone?: string;
}

/**
 * Creates the database user profile for an organization user.
 */
export async function createOrganizationUserProfile(
  supabase: SupabaseClient<Database>,
  input: CreateOrganizationUserProfileInput
): Promise<User> {
  const role = await findRoleByName(supabase, input.roleName);
  if (!role) {
    throw new Error(`Role "${input.roleName}" does not exist`);
  }

  const user = await insertUser(supabase, {
    id: input.authUserId,
    organization_id: input.organizationId,
    full_name: input.fullName,
    email: input.email,
    role_id: role.id,
    username: input.username,
    phone: input.phone || null,
  });

  return user;
}

/**
 * Resolves the display-name pairs for a caller-derived assignable-role list
 * (D9): the client never compares role names, so the label the picker
 * renders is looked up server-side rather than hardcoded on the client.
 */
async function toAssignableRolePairs(
  supabase: SupabaseClient<Database>,
  roleNames: AppRole[]
): Promise<{ name: AppRole; display_name: string }[]> {
  return Promise.all(
    roleNames.map(async (name) => {
      const role = await findRoleByName(supabase, name);
      return { name, display_name: role?.display_name ?? name };
    })
  );
}

export interface OrganizationUserListResult extends PagedResult<User & { role: Role; canManage: boolean }> {
  /** Caller-derived, not per-row (FL3) -- one list for the whole page. */
  assignableRoles: { name: AppRole; display_name: string }[];
}

/**
 * Lists organization users with filters, search, and pagination.
 * Scoped strictly to the caller's organization. Each row carries a
 * server-computed `canManage` hint (ADR-0010) so the UI can hide row
 * actions per UX.md:136 rather than showing them and then failing --
 * computed in-memory from the caller's own role and each row's already
 * role-embedded `role.name`, avoiding an N+1 of `canManageTargetUser` calls.
 */
export async function listOrganizationUsers(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  filters: {
    page: number;
    limit: number;
    search?: string;
    role?: AppRole;
    isActive?: boolean;
  }
): Promise<OrganizationUserListResult> {
  // 1. Authorize general caller capability
  const isAuthorized = await canManageUsers(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  // Get caller's organization ID and role
  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const callerRoleRecord = await findRoleById(supabase, caller.role_id);
  if (!callerRoleRecord) {
    throw new Error("Caller role not found");
  }
  const callerRoleName = callerRoleRecord.name;

  const organizationId = caller.organization_id;

  // 2. Fetch data
  const users = await listUsers(supabase, organizationId, filters);
  const total = await countUsers(supabase, organizationId, filters);
  const assignableRoles = await toAssignableRolePairs(supabase, await getAssignableRoles(supabase, callerUserId));

  return {
    items: users.map((user) => ({
      ...user,
      canManage: callerRoleName === "SUPER_ADMIN" || canManageRole(callerRoleName, user.role.name),
    })),
    total,
    page: filters.page,
    pageSize: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
    assignableRoles,
  };
}

/**
 * Retrieves the details of a specific user.
 * Scoped strictly to the caller's organization. Carries the same
 * server-computed `canManage` hint as the list (ADR-0010).
 */
export async function getUserDetails(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  targetUserId: string
): Promise<User & { role: Role; canManage: boolean }> {
  // 1. Authorize general caller capability
  const isAuthorized = await canManageUsers(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  // 2. Resolve target user
  const targetUser = await findUserWithRoleById(supabase, targetUserId);
  if (!targetUser) {
    throw new AppError("User not found", ErrorCodes.NOT_FOUND);
  }

  // 3. Scoping check: must be in same organization (unless platform super admin)
  const caller = await findUserById(supabase, callerUserId);
  if (!caller) {
    throw new Error("Caller not found");
  }

  const isSuperAdmin = await hasRole(supabase, callerUserId, "SUPER_ADMIN");
  if (!isSuperAdmin && caller.organization_id !== targetUser.organization_id) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  const canManage = await canManageTargetUser(supabase, callerUserId, targetUserId);
  return { ...targetUser, canManage };
}
