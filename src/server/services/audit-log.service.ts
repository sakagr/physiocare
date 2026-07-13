import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { AuditLog } from "../repositories/audit-log.repository";
import { insertAuditLog, listAuditLogs, countAuditLogs } from "../repositories/audit-log.repository";
import { findUserById } from "../repositories/user.repository";
import { canViewAuditLogs } from "./authorization.service";
import { AppError, ErrorCodes } from "../errors";
import type { PagedResult } from "../validators/shared.validator";

/**
 * Records an audit log entry. A cross-cutting helper called explicitly by
 * other orchestration services after a mutation -- not a per-entity CRUD
 * service, and not wired into every mutation this phase (D15: a
 * representative starter set is enough to validate the mechanism).
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
