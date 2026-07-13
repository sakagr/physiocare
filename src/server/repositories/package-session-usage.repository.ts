import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type PackageSessionUsage = Database["public"]["Tables"]["package_session_usage"]["Row"];

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
