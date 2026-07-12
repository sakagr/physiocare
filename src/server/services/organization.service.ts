import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { validateCreateOrganizationInput } from "../validators/organization.validator";
import type { CreateOrganizationInput } from "../validators/organization.validator";
import type { CreateOrganizationUserInput } from "../validators/user.validator";
import {
  findOrganizationByName,
  insertOrganization,
  updateOrganizationCreatedBy,
  updateOrganizationStatus,
} from "../repositories/organization.repository";
import { inviteUser, deleteUser, generateInitialPassword, createAuthUser } from "./auth.service";
import { findUserById } from "../repositories/user.repository";
import {
  createOrganizationOwner,
  ensureUsernameAvailable,
  ensureEmailAvailable,
  createOrganizationUserProfile,
} from "./user.service";
import { AppError, ErrorCodes } from "../errors";

/**
 * Result returned after successfully bootstrapping an organization.
 */
export interface BootstrapOrganizationResult {
  organizationId: string;
  adminUserId: string;
  adminUsername: string;
}

/**
 * Bootstraps a new organization and its initial administrator.
 */
export async function bootstrapOrganization(
  supabase: SupabaseClient<Database>,
  adminClient: SupabaseClient<Database>,
  input: CreateOrganizationInput
): Promise<BootstrapOrganizationResult> {
  // 1. Validate the input
  const validatedInput = validateCreateOrganizationInput(input);

  // 2. Verify that the organization name does not already exist
  const existingOrg = await findOrganizationByName(supabase, validatedInput.organizationName);
  if (existingOrg) {
    throw new AppError(
      `Organization name "${validatedInput.organizationName}" already exists`,
      ErrorCodes.ORGANIZATION_NAME_ALREADY_EXISTS
    );
  }

  // 3. Verify that the administrator email does not already exist
  await ensureEmailAvailable(supabase, validatedInput.adminEmail);

  // 3b. Verify that the administrator username does not already exist
  await ensureUsernameAvailable(supabase, validatedInput.adminUsername);

  // 4. Invite the administrator using the Auth Service
  const authUser = await inviteUser(adminClient, validatedInput.adminEmail);

  try {
    // 5. Create the organization with status = "draft"
    const organization = await insertOrganization(supabase, {
      organization_name: validatedInput.organizationName,
      status: "draft",
    });

    // 6. Create the initial organization owner using the User Service
    const ownerUser = await createOrganizationOwner(supabase, {
      authUserId: authUser.id,
      organizationId: organization.id,
      fullName: validatedInput.adminFullName,
      email: validatedInput.adminEmail,
      username: validatedInput.adminUsername,
    });

    // 7. Update organizations.created_by
    await updateOrganizationCreatedBy(supabase, organization.id, ownerUser.id);

    // 8. Update the organization status to "active"
    await updateOrganizationStatus(supabase, organization.id, "active");

    // 9. Return result
    return {
      organizationId: organization.id,
      adminUserId: ownerUser.id,
      adminUsername: ownerUser.username,
    };
  } catch (error) {
    // Rollback strategy: delete the invited auth user if database operations fail
    try {
      await deleteUser(adminClient, authUser.id);
    } catch {
      //TODO: Introduce centralized monitoring/alerting for compensation failures.
    }
    // Rethrow original exception
    throw error;
  }
}

export interface CreateOrganizationUserResult {
  userId: string;
  username: string;
  initialPassword?: string;
}

/**
 * Orchestrates the onboarding flow for a new organization user.
 * 
 * Flow:
 * 1. Resolves the creator profile to get their organization ID and verify non-null.
 * 2. Checks username and email availability.
 * 3. Generates a secure initial password.
 * 4. Provisions the user in Supabase Auth.
 * 5. Creates the application user profile.
 * 6. Rollback: deletes the Supabase Auth user if profile creation fails.
 */
export async function createOrganizationUser(
  supabase: SupabaseClient<Database>,
  adminClient: SupabaseClient<Database>,
  creatorUserId: string,
  input: CreateOrganizationUserInput
): Promise<CreateOrganizationUserResult> {
  // 1. Resolve creator profile
  const creator = await findUserById(supabase, creatorUserId);
  if (!creator || !creator.organization_id) {
    throw new Error("Creator must belong to a valid organization");
  }

  const organizationId = creator.organization_id;

  // 2. Perform duplicate checks
  await ensureUsernameAvailable(supabase, input.username);
  await ensureEmailAvailable(supabase, input.email);

  // 3. Generate initial password
  const initialPassword = generateInitialPassword();

  // 4. Create the Supabase Auth user identity
  const authUser = await createAuthUser(adminClient, input.email, initialPassword);

  try {
    // 5. Create the database user profile
    const userProfile = await createOrganizationUserProfile(supabase, {
      authUserId: authUser.id,
      organizationId,
      fullName: input.fullName,
      email: input.email,
      username: input.username,
      roleName: input.role,
      phone: input.phone,
    });

    // TODO: Integrate audit logging when the Audit module is implemented.

    return {
      userId: userProfile.id,
      username: userProfile.username,
      initialPassword,
    };
  } catch (error) {
    // Rollback: delete the created auth user
    try {
      await deleteUser(adminClient, authUser.id);
    } catch {
      // Centralized monitoring / alerting for compensation failures in production
    }
    throw error;
  }
}