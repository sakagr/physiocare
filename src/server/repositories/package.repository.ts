import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type Package = Database["public"]["Tables"]["packages"]["Row"];
export type InsertPackage = Database["public"]["Tables"]["packages"]["Insert"];
export type UpdatePackage = Database["public"]["Tables"]["packages"]["Update"];

/**
 * Inserts a new package record.
 */
export async function insertPackage(
  supabase: SupabaseClient<Database>,
  pkg: InsertPackage
): Promise<Package> {
  const { data, error } = await supabase
    .from("packages")
    .insert(pkg)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Updates an existing package record.
 */
export async function updatePackage(
  supabase: SupabaseClient<Database>,
  packageId: string,
  pkg: UpdatePackage
): Promise<Package> {
  const { data, error } = await supabase
    .from("packages")
    .update(pkg)
    .eq("id", packageId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Finds an active (non-deleted) package by ID.
 */
export async function findPackageById(
  supabase: SupabaseClient<Database>,
  packageId: string
): Promise<Package | null> {
  const { data, error } = await supabase
    .from("packages")
    .select("*")
    .eq("id", packageId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Checks if an active package with the given name already exists in the organization.
 */
export async function findPackageByNameInOrg(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  packageName: string
): Promise<Package | null> {
  const { data, error } = await supabase
    .from("packages")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("package_name", packageName)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Lists active packages within an organization with search and pagination filters.
 */
export async function listPackages(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: {
    page: number;
    limit: number;
    search?: string;
    isActive?: boolean;
  }
): Promise<Package[]> {
  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;

  let query = supabase
    .from("packages")
    .select("*")
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (filters.isActive !== undefined) {
    query = query.eq("is_active", filters.isActive);
  }

  if (filters.search) {
    const searchPattern = `%${filters.search}%`;
    query = query.or(`package_name.ilike.${searchPattern}`);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Counts active packages matching search/filter criteria within an organization.
 */
export async function countPackages(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: {
    search?: string;
    isActive?: boolean;
  }
): Promise<number> {
  let query = supabase
    .from("packages")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (filters.isActive !== undefined) {
    query = query.eq("is_active", filters.isActive);
  }

  if (filters.search) {
    const searchPattern = `%${filters.search}%`;
    query = query.or(`package_name.ilike.${searchPattern}`);
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }
  return count || 0;
}
