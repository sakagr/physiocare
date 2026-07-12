import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { User, AppRole } from "../repositories/user.repository";
import {
  findRoleByName,
  insertUser,
  findUserByUsername,
  findUserByEmail,
} from "../repositories/user.repository";
import { AppError, ErrorCodes } from "../errors";

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
