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
