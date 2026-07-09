import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { validateCreateOrganizationInput } from "../validators/organization.validator";
import type { CreateOrganizationInput } from "../validators/organization.validator";
import {
  findOrganizationByName,
  insertOrganization,
  updateOrganizationCreatedBy,
  updateOrganizationStatus,
} from "../repositories/organization.repository";
import { findUserByEmail } from "../repositories/user.repository";
import { inviteUser, deleteUser } from "./auth.service";
import { createOrganizationAdmin } from "./user.service";

/**
 * Result returned after successfully bootstrapping an organization.
 */
export interface BootstrapOrganizationResult {
  organizationId: string;
  adminUserId: string;
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
    throw new Error(`Organization name "${validatedInput.organizationName}" already exists`);
  }

  // 3. Verify that the administrator email does not already exist
  const existingUser = await findUserByEmail(supabase, validatedInput.adminEmail);
  if (existingUser) {
    throw new Error(`Administrator email "${validatedInput.adminEmail}" already exists`);
  }

  // 4. Invite the administrator using the Auth Service
  const authUser = await inviteUser(adminClient, validatedInput.adminEmail);

  try {
    // 5. Create the organization with status = "draft"
    const organization = await insertOrganization(supabase, {
      organization_name: validatedInput.organizationName,
      status: "draft",
    });

    // 6. Create the initial organization administrator using the User Service
    const adminUser = await createOrganizationAdmin(supabase, {
      authUserId: authUser.id,
      organizationId: organization.id,
      fullName: validatedInput.adminFullName,
      email: validatedInput.adminEmail,
    });

    // 7. Update organizations.created_by
    await updateOrganizationCreatedBy(supabase, organization.id, adminUser.id);

    // 8. Update the organization status to "active"
    await updateOrganizationStatus(supabase, organization.id, "active");

    // 9. Return result
    return {
      organizationId: organization.id,
      adminUserId: adminUser.id,
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