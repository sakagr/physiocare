import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type Prescription = Database["public"]["Tables"]["prescriptions"]["Row"];
export type InsertPrescription = Database["public"]["Tables"]["prescriptions"]["Insert"];
export type UpdatePrescription = Database["public"]["Tables"]["prescriptions"]["Update"];

/**
 * Inserts a new prescription record.
 */
export async function insertPrescription(
  supabase: SupabaseClient<Database>,
  prescription: InsertPrescription
): Promise<Prescription> {
  const { data, error } = await supabase
    .from("prescriptions")
    .insert(prescription)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Updates an existing prescription record.
 */
export async function updatePrescription(
  supabase: SupabaseClient<Database>,
  prescriptionId: string,
  prescription: UpdatePrescription
): Promise<Prescription> {
  const { data, error } = await supabase
    .from("prescriptions")
    .update(prescription)
    .eq("id", prescriptionId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Finds a prescription by ID.
 */
export async function findPrescriptionById(
  supabase: SupabaseClient<Database>,
  prescriptionId: string
): Promise<Prescription | null> {
  const { data, error } = await supabase
    .from("prescriptions")
    .select("*")
    .eq("id", prescriptionId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Checks whether any prescription references the given patient.
 */
export async function existsPrescriptionForPatient(
  supabase: SupabaseClient<Database>,
  patientId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from("prescriptions")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", patientId);

  if (error) {
    throw error;
  }
  return (count || 0) > 0;
}

/**
 * Lists prescriptions for a consultation.
 */
export async function listPrescriptionsByConsultation(
  supabase: SupabaseClient<Database>,
  consultationId: string
): Promise<Prescription[]> {
  const { data, error } = await supabase
    .from("prescriptions")
    .select("*")
    .eq("consultation_id", consultationId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Lists prescriptions within an organization with filter and pagination
 * support. When clinicIds is provided (receptionist scoping), results are
 * restricted to prescriptions whose consultation's appointment belongs to
 * one of those clinics.
 */
export async function listPrescriptions(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: {
    page: number;
    limit: number;
    patientId?: string;
    consultationId?: string;
    physiotherapistId?: string;
    clinicIds?: string[];
  }
): Promise<Prescription[]> {
  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;

  let query = supabase
    .from("prescriptions")
    .select(filters.clinicIds ? "*, consultations!inner(appointments!inner(clinic_id))" : "*")
    .eq("organization_id", organizationId);

  if (filters.patientId) {
    query = query.eq("patient_id", filters.patientId);
  }
  if (filters.consultationId) {
    query = query.eq("consultation_id", filters.consultationId);
  }
  if (filters.physiotherapistId) {
    query = query.eq("physiotherapist_id", filters.physiotherapistId);
  }
  if (filters.clinicIds) {
    query = query.in("consultations.appointments.clinic_id", filters.clinicIds);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }
  return data as unknown as Prescription[];
}

/**
 * Counts prescriptions matching filter criteria within an organization.
 */
export async function countPrescriptions(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: {
    patientId?: string;
    consultationId?: string;
    physiotherapistId?: string;
    clinicIds?: string[];
  }
): Promise<number> {
  let query = supabase
    .from("prescriptions")
    .select(filters.clinicIds ? "id, consultations!inner(appointments!inner(clinic_id))" : "id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (filters.patientId) {
    query = query.eq("patient_id", filters.patientId);
  }
  if (filters.consultationId) {
    query = query.eq("consultation_id", filters.consultationId);
  }
  if (filters.physiotherapistId) {
    query = query.eq("physiotherapist_id", filters.physiotherapistId);
  }
  if (filters.clinicIds) {
    query = query.in("consultations.appointments.clinic_id", filters.clinicIds);
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }
  return count || 0;
}
