import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { CreateOrganizationInput } from "../validators/organization.validator";

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
  throw new Error("Not implemented");
}