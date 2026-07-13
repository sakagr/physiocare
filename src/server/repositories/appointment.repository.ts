import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type Appointment = Database["public"]["Tables"]["appointments"]["Row"];
export type InsertAppointment = Database["public"]["Tables"]["appointments"]["Insert"];
export type UpdateAppointment = Database["public"]["Tables"]["appointments"]["Update"];

/**
 * Inserts a new appointment record.
 */
export async function insertAppointment(
  supabase: SupabaseClient<Database>,
  appointment: InsertAppointment
): Promise<Appointment> {
  const { data, error } = await supabase
    .from("appointments")
    .insert(appointment)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Updates an existing appointment record.
 */
export async function updateAppointment(
  supabase: SupabaseClient<Database>,
  appointmentId: string,
  appointment: UpdateAppointment
): Promise<Appointment> {
  const { data, error } = await supabase
    .from("appointments")
    .update(appointment)
    .eq("id", appointmentId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Finds an active (non-deleted) appointment by ID.
 */
export async function findAppointmentById(
  supabase: SupabaseClient<Database>,
  appointmentId: string
): Promise<Appointment | null> {
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Checks whether any active appointment references the given patient.
 */
export async function existsAppointmentForPatient(
  supabase: SupabaseClient<Database>,
  patientId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", patientId)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }
  return (count || 0) > 0;
}

/**
 * Lists active appointments within an organization with filter and pagination support.
 */
export async function listAppointments(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: {
    page: number;
    limit: number;
    patientId?: string;
    clinicId?: string;
    clinicIds?: string[];
    physiotherapistId?: string;
    status?: Database["public"]["Enums"]["appointment_status"];
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<Appointment[]> {
  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;

  let query = supabase
    .from("appointments")
    .select("*")
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (filters.patientId) {
    query = query.eq("patient_id", filters.patientId);
  }
  if (filters.clinicId) {
    query = query.eq("clinic_id", filters.clinicId);
  } else if (filters.clinicIds) {
    query = query.in("clinic_id", filters.clinicIds);
  }
  if (filters.physiotherapistId) {
    query = query.eq("physiotherapist_id", filters.physiotherapistId);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.dateFrom) {
    query = query.gte("appointment_time", filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte("appointment_time", filters.dateTo);
  }

  const { data, error } = await query
    .order("appointment_time", { ascending: true })
    .range(from, to);

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Counts active appointments matching filter criteria within an organization.
 */
export async function countAppointments(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: {
    patientId?: string;
    clinicId?: string;
    clinicIds?: string[];
    physiotherapistId?: string;
    status?: Database["public"]["Enums"]["appointment_status"];
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<number> {
  let query = supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (filters.patientId) {
    query = query.eq("patient_id", filters.patientId);
  }
  if (filters.clinicId) {
    query = query.eq("clinic_id", filters.clinicId);
  } else if (filters.clinicIds) {
    query = query.in("clinic_id", filters.clinicIds);
  }
  if (filters.physiotherapistId) {
    query = query.eq("physiotherapist_id", filters.physiotherapistId);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.dateFrom) {
    query = query.gte("appointment_time", filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte("appointment_time", filters.dateTo);
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }
  return count || 0;
}
