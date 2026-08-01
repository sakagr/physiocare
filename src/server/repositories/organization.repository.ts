import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type InsertOrganization = Database["public"]["Tables"]["organizations"]["Insert"];
export type UpdateOrganization = Database["public"]["Tables"]["organizations"]["Update"];

/**
 * Updates an organization's subscription fields (plan, status, dates).
 *
 * @param supabase - The Supabase client (can be client, server, or admin).
 * @param organizationId - The ID of the organization to update.
 * @param subscription - The subscription fields to update.
 * @returns The updated organization.
 */
export async function updateOrganizationSubscription(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  subscription: Pick<
    UpdateOrganization,
    "subscription_plan_id" | "subscription_status" | "subscription_starts_at" | "subscription_ends_at"
  >
): Promise<Organization> {
  const { data, error } = await supabase
    .from("organizations")
    .update(subscription)
    .eq("id", organizationId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Updates an organization's profile fields (name, default currency).
 *
 * @param supabase - The Supabase client (can be client, server, or admin).
 * @param organizationId - The ID of the organization to update.
 * @param profile - The profile fields to update.
 * @returns The updated organization.
 */
export async function updateOrganizationProfile(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  profile: Pick<UpdateOrganization, "organization_name" | "default_currency_code">
): Promise<Organization> {
  const { data, error } = await supabase
    .from("organizations")
    .update(profile)
    .eq("id", organizationId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

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
 * Finds an organization by ID.
 *
 * @param supabase - The Supabase client (can be client, server, or admin).
 * @param organizationId - The ID of the organization to look up.
 * @returns The organization if found, or null.
 */
export async function findOrganizationById(
  supabase: SupabaseClient<Database>,
  organizationId: string
): Promise<Organization | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", organizationId)
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
 * Lists organizations matching a subscription_status whose subscription_ends_at
 * is before the given cutoff -- a system-wide sweep, not scoped to a single
 * caller's organization. Used by the subscription lapse sweep
 * (expireLapsedSubscriptions), not by any per-organization workflow.
 *
 * @param supabase - The Supabase client (admin only -- this crosses organization boundaries).
 * @param subscriptionStatus - The subscription_status to match.
 * @param endsBefore - ISO timestamp; only organizations whose subscription_ends_at is before this are returned.
 * @returns The matching organizations.
 */
export async function listOrganizationsByLapseCriteria(
  supabase: SupabaseClient<Database>,
  subscriptionStatus: Database["public"]["Enums"]["subscription_status"],
  endsBefore: string
): Promise<Organization[]> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("subscription_status", subscriptionStatus)
    .lt("subscription_ends_at", endsBefore)
    .is("deleted_at", null);

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
