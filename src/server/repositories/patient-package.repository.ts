import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type PatientPackage = Database["public"]["Tables"]["patient_packages"]["Row"];
export type InsertPatientPackage = Database["public"]["Tables"]["patient_packages"]["Insert"];
export type UpdatePatientPackage = Database["public"]["Tables"]["patient_packages"]["Update"];

/**
 * Inserts a new patient package assignment record.
 */
export async function insertPatientPackage(
  supabase: SupabaseClient<Database>,
  patientPackage: InsertPatientPackage
): Promise<PatientPackage> {
  const { data, error } = await supabase
    .from("patient_packages")
    .insert(patientPackage)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Updates an existing patient package assignment record.
 */
export async function updatePatientPackage(
  supabase: SupabaseClient<Database>,
  patientPackageId: string,
  patientPackage: UpdatePatientPackage
): Promise<PatientPackage> {
  const { data, error } = await supabase
    .from("patient_packages")
    .update(patientPackage)
    .eq("id", patientPackageId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Finds an active (non-deleted) patient package assignment by ID.
 */
export async function findPatientPackageById(
  supabase: SupabaseClient<Database>,
  patientPackageId: string
): Promise<PatientPackage | null> {
  const { data, error } = await supabase
    .from("patient_packages")
    .select("*")
    .eq("id", patientPackageId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Lists active patient package assignments for a patient, with pagination.
 */
export async function listPatientPackagesByPatient(
  supabase: SupabaseClient<Database>,
  patientId: string,
  filters: {
    page: number;
    limit: number;
    status?: Database["public"]["Enums"]["package_status"];
  }
): Promise<PatientPackage[]> {
  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;

  let query = supabase
    .from("patient_packages")
    .select("*")
    .eq("patient_id", patientId)
    .is("deleted_at", null);

  if (filters.status) {
    query = query.eq("status", filters.status);
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
 * Counts active patient package assignments for a patient matching filters.
 */
export async function countPatientPackagesByPatient(
  supabase: SupabaseClient<Database>,
  patientId: string,
  filters: {
    status?: Database["public"]["Enums"]["package_status"];
  }
): Promise<number> {
  let query = supabase
    .from("patient_packages")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", patientId)
    .is("deleted_at", null);

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }
  return count || 0;
}

/**
 * Lists active patient package assignments within an organization, with pagination.
 */
export async function listOrganizationPatientPackages(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: {
    page: number;
    limit: number;
    patientId?: string;
    status?: Database["public"]["Enums"]["package_status"];
  }
): Promise<PatientPackage[]> {
  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;

  let query = supabase
    .from("patient_packages")
    .select("*")
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (filters.patientId) {
    query = query.eq("patient_id", filters.patientId);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
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
 * Counts active patient package assignments within an organization matching filters.
 */
export async function countOrganizationPatientPackages(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: {
    patientId?: string;
    status?: Database["public"]["Enums"]["package_status"];
  }
): Promise<number> {
  let query = supabase
    .from("patient_packages")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (filters.patientId) {
    query = query.eq("patient_id", filters.patientId);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }
  return count || 0;
}

/**
 * Checks whether any invoice still references the given patient package.
 */
export async function existsInvoiceForPatientPackage(
  supabase: SupabaseClient<Database>,
  patientPackageId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("patient_package_id", patientPackageId)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }
  return (count || 0) > 0;
}

/**
 * Checks whether any patient package still references the given package.
 */
export async function existsPatientPackagesForPackage(
  supabase: SupabaseClient<Database>,
  packageId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from("patient_packages")
    .select("id", { count: "exact", head: true })
    .eq("package_id", packageId);

  if (error) {
    throw error;
  }
  return (count || 0) > 0;
}
