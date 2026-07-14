import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type Consultation = Database["public"]["Tables"]["consultations"]["Row"];
export type InsertConsultation = Database["public"]["Tables"]["consultations"]["Insert"];
export type UpdateConsultation = Database["public"]["Tables"]["consultations"]["Update"];

/**
 * Inserts a new consultation record.
 */
export async function insertConsultation(
  supabase: SupabaseClient<Database>,
  consultation: InsertConsultation
): Promise<Consultation> {
  const { data, error } = await supabase
    .from("consultations")
    .insert(consultation)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Updates an existing consultation record.
 */
export async function updateConsultation(
  supabase: SupabaseClient<Database>,
  consultationId: string,
  consultation: UpdateConsultation
): Promise<Consultation> {
  const { data, error } = await supabase
    .from("consultations")
    .update(consultation)
    .eq("id", consultationId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Finds a consultation by ID.
 */
export async function findConsultationById(
  supabase: SupabaseClient<Database>,
  consultationId: string
): Promise<Consultation | null> {
  const { data, error } = await supabase
    .from("consultations")
    .select("*")
    .eq("id", consultationId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Finds the consultation for an appointment, if one exists (1:1 relationship).
 */
export async function findConsultationByAppointmentId(
  supabase: SupabaseClient<Database>,
  appointmentId: string
): Promise<Consultation | null> {
  const { data, error } = await supabase
    .from("consultations")
    .select("*")
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Checks whether any consultation references the given patient.
 */
export async function existsConsultationForPatient(
  supabase: SupabaseClient<Database>,
  patientId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from("consultations")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", patientId);

  if (error) {
    throw error;
  }
  return (count || 0) > 0;
}

/**
 * Lists every consultation linked to any of the given appointments.
 * Consultations have no date field of their own that would meaningfully
 * represent "when in the reporting period this happened" -- created_at is
 * just record-insert time, not clinical date -- so report aggregation scopes
 * consultations through the appointment_id of an already date-scoped
 * appointment set (see physiotherapist-report.service.ts) rather than
 * filtering consultations directly. Read-only: exists solely to retrieve
 * reporting data.
 */
export async function listConsultationsByAppointmentIds(
  supabase: SupabaseClient<Database>,
  appointmentIds: string[]
): Promise<Consultation[]> {
  if (appointmentIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("consultations")
    .select("*")
    .in("appointment_id", appointmentIds);

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Lists consultations within an organization with filter and pagination support.
 * When clinicIds is provided (receptionist scoping), results are restricted
 * to consultations whose appointment belongs to one of those clinics.
 */
export async function listConsultations(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: {
    page: number;
    limit: number;
    patientId?: string;
    physiotherapistId?: string;
    clinicIds?: string[];
  }
): Promise<Consultation[]> {
  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;

  let query = supabase
    .from("consultations")
    .select(filters.clinicIds ? "*, appointments!inner(clinic_id)" : "*")
    .eq("organization_id", organizationId);

  if (filters.patientId) {
    query = query.eq("patient_id", filters.patientId);
  }
  if (filters.physiotherapistId) {
    query = query.eq("physiotherapist_id", filters.physiotherapistId);
  }
  if (filters.clinicIds) {
    query = query.in("appointments.clinic_id", filters.clinicIds);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }
  return data as unknown as Consultation[];
}

/**
 * Counts consultations matching filter criteria within an organization.
 */
export async function countConsultations(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: {
    patientId?: string;
    physiotherapistId?: string;
    clinicIds?: string[];
  }
): Promise<number> {
  let query = supabase
    .from("consultations")
    .select(filters.clinicIds ? "id, appointments!inner(clinic_id)" : "id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (filters.patientId) {
    query = query.eq("patient_id", filters.patientId);
  }
  if (filters.physiotherapistId) {
    query = query.eq("physiotherapist_id", filters.physiotherapistId);
  }
  if (filters.clinicIds) {
    query = query.in("appointments.clinic_id", filters.clinicIds);
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }
  return count || 0;
}
