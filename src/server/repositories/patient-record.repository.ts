import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type PatientRecord = Database["public"]["Tables"]["patient_records"]["Row"];
export type InsertPatientRecord = Database["public"]["Tables"]["patient_records"]["Insert"];

/**
 * Inserts a new patient record. The only field a record's lifetime ever
 * changes is deleted_at (softDeletePatientRecord); records are otherwise
 * immutable once uploaded.
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
 * Soft-deletes a patient record. A hard delete would not work: the table's
 * delete policy is is_super_admin() only, so an Owner's delete would silently
 * affect zero rows. The update policy's Owner/Admin branch is org-wide.
 */
export async function softDeletePatientRecord(
  supabase: SupabaseClient<Database>,
  recordId: string
): Promise<PatientRecord> {
  const { data, error } = await supabase
    .from("patient_records")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", recordId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Finds an active (non-deleted) patient record by ID.
 */
export async function findPatientRecordById(
  supabase: SupabaseClient<Database>,
  recordId: string
): Promise<PatientRecord | null> {
  const { data, error } = await supabase
    .from("patient_records")
    .select("*")
    .eq("id", recordId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Checks whether any active patient record references the given patient.
 * Feeds hasClinicalReferences (patient.service.ts), which blocks patient
 * deletion -- so the liveness filter here is what lets a patient whose only
 * record was deleted be deleted in turn.
 */
export async function existsPatientRecordForPatient(
  supabase: SupabaseClient<Database>,
  patientId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from("patient_records")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", patientId)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }
  return (count || 0) > 0;
}

/**
 * Lists a patient's active records with pagination, most recent first.
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
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Counts a patient's active records.
 */
export async function countPatientRecordsByPatient(
  supabase: SupabaseClient<Database>,
  patientId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("patient_records")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", patientId)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }
  return count || 0;
}
