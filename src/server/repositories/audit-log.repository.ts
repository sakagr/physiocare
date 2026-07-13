import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];
export type InsertAuditLog = Database["public"]["Tables"]["audit_logs"]["Insert"];

/**
 * Inserts a new audit log record. Append-only -- there is no update/delete
 * counterpart, matching the immutable, write-once nature of an audit trail.
 */
export async function insertAuditLog(
  supabase: SupabaseClient<Database>,
  auditLog: InsertAuditLog
): Promise<AuditLog> {
  const { data, error } = await supabase
    .from("audit_logs")
    .insert(auditLog)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Lists audit log records within an organization with pagination filters.
 */
export async function listAuditLogs(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: {
    page: number;
    limit: number;
    entityName?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<AuditLog[]> {
  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;

  let query = supabase
    .from("audit_logs")
    .select("*")
    .eq("organization_id", organizationId);

  if (filters.entityName) {
    query = query.eq("entity_name", filters.entityName);
  }

  if (filters.userId) {
    query = query.eq("user_id", filters.userId);
  }

  if (filters.dateFrom) {
    query = query.gte("created_at", filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte("created_at", filters.dateTo);
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
 * Counts audit log records matching filter criteria within an organization.
 */
export async function countAuditLogs(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  filters: {
    entityName?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<number> {
  let query = supabase
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (filters.entityName) {
    query = query.eq("entity_name", filters.entityName);
  }

  if (filters.userId) {
    query = query.eq("user_id", filters.userId);
  }

  if (filters.dateFrom) {
    query = query.gte("created_at", filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte("created_at", filters.dateTo);
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }
  return count || 0;
}
