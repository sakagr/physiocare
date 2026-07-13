import { z } from "zod";
import { paginationSchema } from "./shared.validator";

/**
 * Validation schema for the audit log list query. There is no create schema
 * -- audit rows are never user-submitted, only written internally via
 * recordAuditLog() from other services.
 */
export const auditLogListQuerySchema = paginationSchema.extend({
  entityName: z.string().trim().optional().or(z.literal("")),
  userId: z.string().uuid({ message: "Invalid user ID format." }).optional(),
  dateFrom: z.string().datetime({ message: "Invalid date." }).optional(),
  dateTo: z.string().datetime({ message: "Invalid date." }).optional(),
});

export type AuditLogListQuery = z.infer<typeof auditLogListQuerySchema>;
