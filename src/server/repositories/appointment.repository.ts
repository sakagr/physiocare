import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type Appointment = Database["public"]["Tables"]["appointments"]["Row"];
export type InsertAppointment = Database["public"]["Tables"]["appointments"]["Insert"];
export type UpdateAppointment = Database["public"]["Tables"]["appointments"]["Update"];

/**
 * The display projection embedded in appointment *reads* (F6, D1).
 *
 * Every F6 appointment surface renders patient, physiotherapist and clinic
 * *names* against a row that carries only UUIDs. This is embedded in the read
 * rather than exposed as a database view: a view forces the write-then-re-read
 * round trip `patient_packages_view` pays, widens every column to nullable,
 * and freezes its column list behind a parity test.
 *
 * `physiotherapist` must name its foreign key explicitly. `appointments` has
 * *two* foreign keys into `users` -- `physiotherapist_id` and `created_by` --
 * so an unqualified `users(...)` embed is ambiguous and PostgREST rejects it.
 *
 * Each embed is nullable because a joined row filtered by RLS comes back as
 * `null` rather than as an error (ADR-0011). In practice it is never null for
 * a caller who can see the appointment at all; that is proved through real
 * session clients per role in `tests/integration/appointments.test.ts`, which
 * is a hard requirement of this design rather than incidental coverage.
 *
 * The embeds carry no liveness filter of their own, so a soft-deleted patient,
 * physiotherapist or clinic still renders its name here. That is deliberate:
 * the appointment's reference is historical, and a schedule row showing a
 * blank name because the patient was later removed would be worse than one
 * naming who it was actually for.
 */
const APPOINTMENT_DISPLAY_SELECT =
  "*, patient:patients(id, full_name, patient_code), " +
  "physiotherapist:users!appointments_organization_id_physiotherapist_id_fkey(id, full_name), " +
  "clinic:clinics(id, clinic_name)";

export interface AppointmentDisplay {
  patient: { id: string; full_name: string; patient_code: string } | null;
  physiotherapist: { id: string; full_name: string } | null;
  clinic: { id: string; clinic_name: string } | null;
}

export type AppointmentWithDisplay = Appointment & AppointmentDisplay;

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
 * Finds an active appointment by ID with its display projection.
 *
 * Kept separate from `findAppointmentById` rather than replacing it. That
 * function is called by the authorization predicates, the workflow services,
 * and the admin-client system paths (`cancelAppointmentAsSystem`) -- none of
 * which render anything, and none of which should pay a three-table join or
 * see a widened row type.
 */
export async function findAppointmentWithDisplayById(
  supabase: SupabaseClient<Database>,
  appointmentId: string
): Promise<AppointmentWithDisplay | null> {
  const { data, error } = await supabase
    .from("appointments")
    .select(APPOINTMENT_DISPLAY_SELECT)
    .eq("id", appointmentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data as AppointmentWithDisplay | null;
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
 * Lists active appointments within an organization with filter and pagination
 * support, each carrying its display projection (see
 * `APPOINTMENT_DISPLAY_SELECT`). Changed in place rather than added alongside:
 * `listOrganizationAppointments` is its only caller, and every consumer of
 * that listing renders names.
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
): Promise<AppointmentWithDisplay[]> {
  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;

  let query = supabase
    .from("appointments")
    .select(APPOINTMENT_DISPLAY_SELECT)
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
  return data as unknown as AppointmentWithDisplay[];
}

/**
 * Lists every active appointment within an organization whose
 * appointment_time falls within the given range, for report aggregation.
 * Not paginated; callers are expected to have already bounded the date
 * range. Read-only: exists solely to retrieve reporting data.
 */
export async function listAppointmentsForReport(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: {
    dateFrom: string;
    dateTo: string;
    physiotherapistId?: string;
    clinicId?: string;
  }
): Promise<Appointment[]> {
  let query = supabase
    .from("appointments")
    .select("*")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .gte("appointment_time", filters.dateFrom)
    .lte("appointment_time", filters.dateTo);

  if (filters.physiotherapistId) {
    query = query.eq("physiotherapist_id", filters.physiotherapistId);
  }
  if (filters.clinicId) {
    query = query.eq("clinic_id", filters.clinicId);
  }

  const { data, error } = await query.order("appointment_time", { ascending: true });

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Lists every active appointment for a physiotherapist within a time range,
 * for the availability auto-cancel workflow. Unpaginated -- callers are
 * expected to have already bounded the date. Deliberately **not**
 * clinic-scoped: unavailability is organization-wide, not per clinic (D-N)
 * -- the partial unique index on (organization_id, user_id, attendance_date)
 * permits only one live attendance row per person per day, so a physiotherapist
 * marked absent at one clinic is absent everywhere they work that day.
 * `listAppointmentsForReport` is deliberately not reused here: its own doc
 * comment scopes it to reporting, and widening that contract to serve a
 * write path would make a future reporting change silently a scheduling one.
 */
export async function listActiveAppointmentsForPhysiotherapistInRange(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  physiotherapistId: string,
  fromIso: string,
  toIso: string
): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("physiotherapist_id", physiotherapistId)
    .is("deleted_at", null)
    .gte("appointment_time", fromIso)
    .lte("appointment_time", toIso)
    .order("appointment_time", { ascending: true });

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
