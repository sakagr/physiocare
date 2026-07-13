import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type Patient = Database["public"]["Tables"]["patients"]["Row"];
export type InsertPatient = Database["public"]["Tables"]["patients"]["Insert"];
export type UpdatePatient = Database["public"]["Tables"]["patients"]["Update"];

/**
 * Inserts a new patient record.
 */
export async function insertPatient(
  supabase: SupabaseClient<Database>,
  patient: InsertPatient
): Promise<Patient> {
  const { data, error } = await supabase
    .from("patients")
    .insert(patient)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Updates an existing patient record.
 */
export async function updatePatient(
  supabase: SupabaseClient<Database>,
  patientId: string,
  patient: UpdatePatient
): Promise<Patient> {
  const { data, error } = await supabase
    .from("patients")
    .update(patient)
    .eq("id", patientId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Finds an active (non-deleted) patient by ID.
 */
export async function findPatientById(
  supabase: SupabaseClient<Database>,
  patientId: string
): Promise<Patient | null> {
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Finds an active patient by their immutable patient code within an organization.
 */
export async function findPatientByCode(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  patientCode: string
): Promise<Patient | null> {
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("patient_code", patientCode)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Finds the highest existing patient_code within an organization, including
 * soft-deleted patients (codes are immutable and must never be reused).
 */
export async function findLatestPatientCodeInOrg(
  supabase: SupabaseClient<Database>,
  organizationId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("patients")
    .select("patient_code")
    .eq("organization_id", organizationId)
    .order("patient_code", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data?.patient_code ?? null;
}

/**
 * Lists active patients within an organization with search and pagination filters.
 */
export async function listPatients(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: {
    page: number;
    limit: number;
    search?: string;
    gender?: Database["public"]["Enums"]["patient_gender"];
  }
): Promise<Patient[]> {
  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;

  let query = supabase
    .from("patients")
    .select("*")
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (filters.gender) {
    query = query.eq("gender", filters.gender);
  }

  if (filters.search) {
    const searchPattern = `%${filters.search}%`;
    query = query.or(
      `full_name.ilike.${searchPattern},patient_code.ilike.${searchPattern},phone.ilike.${searchPattern},email.ilike.${searchPattern},emergency_contact.ilike.${searchPattern}`
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
 * Counts active patients matching search/filter criteria within an organization.
 */
export async function countPatients(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: {
    search?: string;
    gender?: Database["public"]["Enums"]["patient_gender"];
  }
): Promise<number> {
  let query = supabase
    .from("patients")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (filters.gender) {
    query = query.eq("gender", filters.gender);
  }

  if (filters.search) {
    const searchPattern = `%${filters.search}%`;
    query = query.or(
      `full_name.ilike.${searchPattern},patient_code.ilike.${searchPattern},phone.ilike.${searchPattern},email.ilike.${searchPattern},emergency_contact.ilike.${searchPattern}`
    );
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }
  return count || 0;
}
