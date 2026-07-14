import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type PackageSessionUsage = Database["public"]["Tables"]["package_session_usage"]["Row"];

/**
 * Finds the active (non-deleted) session usage row recorded against an
 * appointment, or null if that appointment was never package-linked.
 */
export async function findUsageByAppointmentId(
  supabase: SupabaseClient<Database>,
  appointmentId: string
): Promise<PackageSessionUsage | null> {
  const { data, error } = await supabase
    .from("package_session_usage")
    .select("*")
    .eq("appointment_id", appointmentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Lists active session usage rows for a batch of appointments, for report
 * aggregation. Not paginated; callers are expected to have already bounded
 * the appointment set.
 */
export async function listUsageByAppointmentIds(
  supabase: SupabaseClient<Database>,
  appointmentIds: string[]
): Promise<PackageSessionUsage[]> {
  if (appointmentIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("package_session_usage")
    .select("*")
    .in("appointment_id", appointmentIds)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Atomically records a session consumption and decrements the parent
 * patient package's balance via the consume_package_session database
 * function (see AGENTS.md "Database Functions for Atomic Operations").
 */
export async function consumePackageSession(
  supabase: SupabaseClient<Database>,
  params: {
    organizationId: string;
    patientPackageId: string;
    appointmentId: string;
    usedOn?: string;
  }
): Promise<PackageSessionUsage> {
  const { data, error } = await supabase
    .rpc("consume_package_session", {
      p_organization_id: params.organizationId,
      p_patient_package_id: params.patientPackageId,
      p_appointment_id: params.appointmentId,
      p_used_on: params.usedOn,
    })
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Atomically soft-deletes a session usage row and restores the parent
 * patient package's balance via the reverse_package_session_usage database
 * function. Returns null if the appointment was never package-linked.
 */
export async function reversePackageSessionUsage(
  supabase: SupabaseClient<Database>,
  params: {
    organizationId: string;
    appointmentId: string;
  }
): Promise<PackageSessionUsage | null> {
  const { data, error } = await supabase
    .rpc("reverse_package_session_usage", {
      p_organization_id: params.organizationId,
      p_appointment_id: params.appointmentId,
    })
    .maybeSingle();

  if (error) {
    throw error;
  }
  // A plpgsql function declared to return a single composite row represents
  // "nothing to reverse" (RETURN NULL inside the function) as a row of
  // all-null columns over PostgREST, not a JSON null -- detect that
  // explicitly rather than trusting `data` itself to be null.
  const row = data as PackageSessionUsage | null;
  return row && row.id !== null ? row : null;
}

/**
 * Lists session usage history for a patient package. Read-only in this
 * phase -- the write path that records consumption on appointment
 * completion is Phase 8's "Package Session Consumption Logic."
 */
export async function listByPatientPackage(
  supabase: SupabaseClient<Database>,
  patientPackageId: string,
  filters: {
    page: number;
    limit: number;
  }
): Promise<PackageSessionUsage[]> {
  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;

  const { data, error } = await supabase
    .from("package_session_usage")
    .select("*")
    .eq("patient_package_id", patientPackageId)
    .is("deleted_at", null)
    .order("used_on", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Counts session usage history rows for a patient package.
 */
export async function countByPatientPackage(
  supabase: SupabaseClient<Database>,
  patientPackageId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("package_session_usage")
    .select("id", { count: "exact", head: true })
    .eq("patient_package_id", patientPackageId)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }
  return count || 0;
}
