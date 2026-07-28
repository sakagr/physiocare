import { z } from "zod";
import { pagedResultSchema } from "./shared.contract";

/**
 * Response contract for the Audit Logs domain (F2, M8/R8). Client-safe --
 * never imports from `src/server/**` or `src/types/database.ts`. Mirrors
 * `src/server/repositories/audit-log.repository.ts` → `AuditLog` (the
 * `audit_logs` table row). `old_data`/`new_data` are the database's `Json`
 * column type -- an arbitrary JSON value, not a fixed shape.
 */
export const auditLogSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  /** null for a system-actor entry (no caller -- see subscription.service.ts's lapse sweep). */
  user_id: z.string().nullable(),
  action: z.string(),
  entity_name: z.string(),
  entity_id: z.string(),
  old_data: z.unknown().nullable(),
  new_data: z.unknown().nullable(),
  created_at: z.string(),
});

/** GET /api/audit-logs. */
export const auditLogListResponseSchema = pagedResultSchema(auditLogSchema);
