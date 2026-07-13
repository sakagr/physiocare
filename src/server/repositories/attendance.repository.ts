import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type Attendance = Database["public"]["Tables"]["user_attendance"]["Row"];
export type InsertAttendance = Database["public"]["Tables"]["user_attendance"]["Insert"];
export type UpdateAttendance = Database["public"]["Tables"]["user_attendance"]["Update"];

/**
 * Inserts a new attendance record.
 */
export async function insertAttendance(
  supabase: SupabaseClient<Database>,
  attendance: InsertAttendance
): Promise<Attendance> {
  const { data, error } = await supabase
    .from("user_attendance")
    .insert(attendance)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Updates an existing attendance record.
 */
export async function updateAttendance(
  supabase: SupabaseClient<Database>,
  attendanceId: string,
  attendance: UpdateAttendance
): Promise<Attendance> {
  const { data, error } = await supabase
    .from("user_attendance")
    .update(attendance)
    .eq("id", attendanceId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Finds an active (non-deleted) attendance record by ID.
 */
export async function findAttendanceById(
  supabase: SupabaseClient<Database>,
  attendanceId: string
): Promise<Attendance | null> {
  const { data, error } = await supabase
    .from("user_attendance")
    .select("*")
    .eq("id", attendanceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Finds the active attendance record for a user on a given date, if any.
 */
export async function findAttendanceByUserAndDate(
  supabase: SupabaseClient<Database>,
  userId: string,
  attendanceDate: string
): Promise<Attendance | null> {
  const { data, error } = await supabase
    .from("user_attendance")
    .select("*")
    .eq("user_id", userId)
    .eq("attendance_date", attendanceDate)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Lists active attendance records within an organization with pagination filters.
 */
export async function listAttendance(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: {
    page: number;
    limit: number;
    userId?: string;
    clinicId?: string;
    clinicIds?: string[];
    dateFrom?: string;
    dateTo?: string;
    status?: Database["public"]["Enums"]["attendance_status"];
  }
): Promise<Attendance[]> {
  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;

  let query = supabase
    .from("user_attendance")
    .select("*")
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (filters.userId) {
    query = query.eq("user_id", filters.userId);
  }

  if (filters.clinicId) {
    query = query.eq("clinic_id", filters.clinicId);
  } else if (filters.clinicIds) {
    query = query.in("clinic_id", filters.clinicIds);
  }

  if (filters.dateFrom) {
    query = query.gte("attendance_date", filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte("attendance_date", filters.dateTo);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query
    .order("attendance_date", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Counts active attendance records matching filter criteria within an organization.
 */
export async function countAttendance(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: {
    userId?: string;
    clinicId?: string;
    clinicIds?: string[];
    dateFrom?: string;
    dateTo?: string;
    status?: Database["public"]["Enums"]["attendance_status"];
  }
): Promise<number> {
  let query = supabase
    .from("user_attendance")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (filters.userId) {
    query = query.eq("user_id", filters.userId);
  }

  if (filters.clinicId) {
    query = query.eq("clinic_id", filters.clinicId);
  } else if (filters.clinicIds) {
    query = query.in("clinic_id", filters.clinicIds);
  }

  if (filters.dateFrom) {
    query = query.gte("attendance_date", filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte("attendance_date", filters.dateTo);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }
  return count || 0;
}
