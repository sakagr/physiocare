import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type AppointmentStatusLog = Database["public"]["Tables"]["appointment_status_logs"]["Row"];
export type InsertAppointmentStatusLog = Database["public"]["Tables"]["appointment_status_logs"]["Insert"];

/**
 * Inserts a new appointment status log record. Append-only -- there is no
 * update/delete counterpart, matching the immutable, write-once nature of
 * an audit trail.
 */
export async function insertAppointmentStatusLog(
  supabase: SupabaseClient<Database>,
  statusLog: InsertAppointmentStatusLog
): Promise<AppointmentStatusLog> {
  const { data, error } = await supabase
    .from("appointment_status_logs")
    .insert(statusLog)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}
