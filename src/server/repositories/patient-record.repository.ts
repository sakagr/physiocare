import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type PatientRecord = Database["public"]["Tables"]["patient_records"]["Row"];
export type InsertPatientRecord = Database["public"]["Tables"]["patient_records"]["Insert"];

/**
 * Inserts a new patient record. Records are append-only in V1 — there is no
 * update or delete.
 */
export async function insertPatientRecord(
  supabase: SupabaseClient<Database>,
  record: InsertPatientRecord
): Promise<PatientRecord> {
  const { data, error } = await supabase
    .from("patient_records")
    .insert(record)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Finds a patient record by ID.
 */
export async function findPatientRecordById(
  supabase: SupabaseClient<Database>,
  recordId: string
): Promise<PatientRecord | null> {
  const { data, error } = await supabase
    .from("patient_records")
    .select("*")
    .eq("id", recordId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Checks whether any patient record references the given patient.
 */
export async function existsPatientRecordForPatient(
  supabase: SupabaseClient<Database>,
  patientId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from("patient_records")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", patientId);

  if (error) {
    throw error;
  }
  return (count || 0) > 0;
}

/**
 * Lists a patient's records with pagination, most recent first.
 */
export async function listPatientRecordsByPatient(
  supabase: SupabaseClient<Database>,
  patientId: string,
  filters: { page: number; limit: number }
): Promise<PatientRecord[]> {
  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;

  const { data, error } = await supabase
    .from("patient_records")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Counts a patient's records.
 */
export async function countPatientRecordsByPatient(
  supabase: SupabaseClient<Database>,
  patientId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("patient_records")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", patientId);

  if (error) {
    throw error;
  }
  return count || 0;
}
