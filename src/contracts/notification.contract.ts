import { z } from "zod";
import { pagedResultSchema } from "./shared.contract";

/**
 * Response contracts for the Notifications domain (F2, M8/R8). Client-safe
 * -- never imports from `src/server/**` or `src/types/database.ts`.
 * Mirrors `src/server/repositories/notification.repository.ts` →
 * `Notification` (the `notifications` table row). Persistence only in this
 * phase -- `sent_at` stays null; there is no dispatch integration yet.
 */
export const notificationSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  recipient_type: z.enum(["user", "patient"]),
  user_id: z.string().nullable(),
  patient_id: z.string().nullable(),
  appointment_id: z.string().nullable(),
  notification_type: z.string(),
  channel: z.enum(["sms", "email", "whatsapp", "in_app"]),
  message: z.string(),
  status: z.enum(["pending", "sent", "failed", "cancelled"]),
  sent_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

/** GET /api/notifications. */
export const notificationListResponseSchema = pagedResultSchema(notificationSchema);
