import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type InsertNotification = Database["public"]["Tables"]["notifications"]["Insert"];

/**
 * Inserts a new notification record.
 */
export async function insertNotification(
  supabase: SupabaseClient<Database>,
  notification: InsertNotification
): Promise<Notification> {
  const { data, error } = await supabase
    .from("notifications")
    .insert(notification)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Inserts a notification record without reading it back.
 *
 * insertNotification above returns the inserted row, which requires a select
 * the caller's own session may not be allowed to perform: notifications_insert_policy
 * admits any org member, but notifications_select_policy admits only the
 * recipient themselves, ORG_ADMIN, or SUPER_ADMIN. Through a physiotherapist's
 * or receptionist's session client the insert commits and the read-back
 * returns no rows, so the caller sees an error for a write that actually
 * succeeded -- the same shape insertAuditLogWithoutReturn exists for. Callers
 * with no use for the row use this.
 */
export async function insertNotificationWithoutReturn(
  supabase: SupabaseClient<Database>,
  notification: InsertNotification
): Promise<void> {
  const { error } = await supabase.from("notifications").insert(notification);

  if (error) {
    throw error;
  }
}

/**
 * Finds an active (non-deleted) notification by ID.
 */
export async function findNotificationById(
  supabase: SupabaseClient<Database>,
  notificationId: string
): Promise<Notification | null> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("id", notificationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Lists active notifications within an organization with pagination filters.
 */
export async function listNotifications(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: {
    page: number;
    limit: number;
    userId?: string;
    patientId?: string;
    status?: Database["public"]["Enums"]["notification_status"];
  }
): Promise<Notification[]> {
  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (filters.userId) {
    query = query.eq("user_id", filters.userId);
  }

  if (filters.patientId) {
    query = query.eq("patient_id", filters.patientId);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Counts active notifications matching filter criteria within an organization.
 */
export async function countNotifications(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: {
    userId?: string;
    patientId?: string;
    status?: Database["public"]["Enums"]["notification_status"];
  }
): Promise<number> {
  let query = supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (filters.userId) {
    query = query.eq("user_id", filters.userId);
  }

  if (filters.patientId) {
    query = query.eq("patient_id", filters.patientId);
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
