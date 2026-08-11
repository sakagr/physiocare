import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { AuditLog } from "../repositories/audit-log.repository";
import {
  insertAuditLog,
  insertAuditLogWithoutReturn,
  listAuditLogs,
  countAuditLogs,
} from "../repositories/audit-log.repository";
import { findUserById } from "../repositories/user.repository";
import { canViewAuditLogs } from "./authorization.service";
import { AppError, ErrorCodes } from "../errors";
import type { PagedResult } from "../validators/shared.validator";

/**
 * Records an audit log entry. A cross-cutting helper called explicitly by
 * other orchestration services after a mutation -- not a per-entity CRUD
 * service. Coverage before F5 was a deliberate starter set (D15: enough to
 * validate the mechanism); F5 logs every write in its own surface area and
 * the pre-F5 features are retrofitted in R9.
 *
 * This function throws on failure. New call sites should use
 * recordAuditLogSafe below unless the caller genuinely wants a failed audit
 * insert to fail the command.
 */
export async function recordAuditLog(
  supabase: SupabaseClient<Database>,
  entry: {
    organizationId: string;
    userId: string | null;
    action: string;
    entityName: string;
    entityId: string;
    oldData?: Json | null;
    newData?: Json | null;
  }
): Promise<AuditLog> {
  return insertAuditLog(supabase, {
    organization_id: entry.organizationId,
    user_id: entry.userId,
    action: entry.action,
    entity_name: entry.entityName,
    entity_id: entry.entityId,
    old_data: entry.oldData ?? null,
    new_data: entry.newData ?? null,
  });
}

/**
 * Renders an unknown thrown value for the warning below. Supabase rejects with
 * a plain PostgrestError object, not an Error, so `String(error)` would emit
 * "[object Object]" and lose the only useful part.
 */
function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

/**
 * Records an audit entry without ever failing the operation it describes.
 * The mutation has already committed and no transaction spans both writes,
 * so a failed audit insert must not surface as a failed command.
 *
 * The warning deliberately carries identifiers and the error only -- never
 * oldData/newData, which are full row snapshots and, for patients and
 * patient records, contain personal and clinical data. Logs are not
 * access-controlled; audit_logs is (Owner/Admin only).
 */
export async function recordAuditLogSafe(
  supabase: SupabaseClient<Database>,
  entry: Parameters<typeof recordAuditLog>[1]
): Promise<void> {
  try {
    await insertAuditLogWithoutReturn(supabase, {
      organization_id: entry.organizationId,
      user_id: entry.userId,
      action: entry.action,
      entity_name: entry.entityName,
      entity_id: entry.entityId,
      old_data: entry.oldData ?? null,
      new_data: entry.newData ?? null,
    });
  } catch (error) {
    // TODO: Introduce centralized monitoring/alerting for audit failures.
    console.warn("[audit] failed to record entry", {
      organizationId: entry.organizationId,
      userId: entry.userId,
      action: entry.action,
      entityName: entry.entityName,
      entityId: entry.entityId,
      error: describeError(error),
    });
  }
}

/**
 * Lists organization audit log entries with pagination support.
 * ORG_OWNER/ORG_ADMIN/SUPER_ADMIN only.
 */
export async function listOrganizationAuditLogs(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  filters: {
    page: number;
    limit: number;
    entityName?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<PagedResult<AuditLog>> {
  const isAuthorized = await canViewAuditLogs(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const items = await listAuditLogs(supabase, caller.organization_id, filters);
  const total = await countAuditLogs(supabase, caller.organization_id, filters);

  return {
    items,
    total,
    page: filters.page,
    pageSize: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}
