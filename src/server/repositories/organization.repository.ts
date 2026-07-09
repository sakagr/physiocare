import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type InsertOrganization = Database["public"]["Tables"]["organizations"]["Insert"];
export type UpdateOrganization = Database["public"]["Tables"]["organizations"]["Update"];

/**
 * Finds an organization by its unique name.
 * 
 * @param supabase - The Supabase client (can be client, server, or admin).
 * @param name - The organization name to look up.
 * @returns The organization if found, or null.
 */
export async function findOrganizationByName(
  supabase: SupabaseClient<Database>,
  name: string
): Promise<Organization | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("organization_name", name)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Inserts a new organization in the database.
 * 
 * @param supabase - The Supabase client (can be client, server, or admin).
 * @param organization - The organization insert payload.
 * @returns The created organization.
 */
export async function insertOrganization(
  supabase: SupabaseClient<Database>,
  organization: InsertOrganization
): Promise<Organization> {
  const { data, error } = await supabase
    .from("organizations")
    .insert(organization)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Updates the creator user reference of an organization.
 * 
 * @param supabase - The Supabase client (can be client, server, or admin).
 * @param organizationId - The ID of the organization to update.
 * @param createdByUserId - The ID of the user who created it.
 * @returns The updated organization.
 */
export async function updateOrganizationCreatedBy(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  createdByUserId: string
): Promise<Organization> {
  const { data, error } = await supabase
    .from("organizations")
    .update({ created_by: createdByUserId })
    .eq("id", organizationId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Updates the operational status of an organization.
 * 
 * @param supabase - The Supabase client (can be client, server, or admin).
 * @param organizationId - The ID of the organization to update.
 * @param status - The new operational status.
 * @returns The updated organization.
 */
export async function updateOrganizationStatus(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  status: Database["public"]["Enums"]["organization_status"]
): Promise<Organization> {
  const { data, error } = await supabase
    .from("organizations")
    .update({ status })
    .eq("id", organizationId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}
