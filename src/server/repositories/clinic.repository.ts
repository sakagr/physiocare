import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type Clinic = Database["public"]["Tables"]["clinics"]["Row"];
export type InsertClinic = Database["public"]["Tables"]["clinics"]["Insert"];
export type UpdateClinic = Database["public"]["Tables"]["clinics"]["Update"];

/**
 * Inserts a new clinic record.
 */
export async function insertClinic(
  supabase: SupabaseClient<Database>,
  clinic: InsertClinic
): Promise<Clinic> {
  const { data, error } = await supabase
    .from("clinics")
    .insert(clinic)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Updates an existing clinic record.
 */
export async function updateClinic(
  supabase: SupabaseClient<Database>,
  clinicId: string,
  clinic: UpdateClinic
): Promise<Clinic> {
  const { data, error } = await supabase
    .from("clinics")
    .update(clinic)
    .eq("id", clinicId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Finds an active (non-deleted) clinic by ID.
 */
export async function findClinicById(
  supabase: SupabaseClient<Database>,
  clinicId: string
): Promise<Clinic | null> {
  const { data, error } = await supabase
    .from("clinics")
    .select("*")
    .eq("id", clinicId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Checks if an active clinic with the given name already exists in the organization.
 */
export async function findClinicByNameInOrg(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  clinicName: string
): Promise<Clinic | null> {
  const { data, error } = await supabase
    .from("clinics")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("clinic_name", clinicName)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Lists active clinics within an organization with search and pagination filters.
 */
export async function listClinics(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: {
    page: number;
    limit: number;
    search?: string;
    isActive?: boolean;
  }
): Promise<Clinic[]> {
  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;

  let query = supabase
    .from("clinics")
    .select("*")
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (filters.isActive !== undefined) {
    query = query.eq("is_active", filters.isActive);
  }

  if (filters.search) {
    const searchPattern = `%${filters.search}%`;
    query = query.or(
      `clinic_name.ilike.${searchPattern},phone.ilike.${searchPattern},email.ilike.${searchPattern},city.ilike.${searchPattern}`
    );
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
 * Counts active clinics matching search/filter criteria within an organization.
 */
export async function countClinics(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: {
    search?: string;
    isActive?: boolean;
  }
): Promise<number> {
  let query = supabase
    .from("clinics")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (filters.isActive !== undefined) {
    query = query.eq("is_active", filters.isActive);
  }

  if (filters.search) {
    const searchPattern = `%${filters.search}%`;
    query = query.or(
      `clinic_name.ilike.${searchPattern},phone.ilike.${searchPattern},email.ilike.${searchPattern},city.ilike.${searchPattern}`
    );
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }
  return count || 0;
}
