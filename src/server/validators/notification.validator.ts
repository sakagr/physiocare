import { z } from "zod";
import { paginationSchema } from "./shared.validator";

/**
 * Validation schema for creating a notification record. Enforces the same
 * recipient XOR the database CHECK constraint enforces, so a bad request
 * fails cleanly at the validator instead of surfacing a raw Postgres error.
 */
export const createNotificationSchema = z
  .object({
    recipientType: z.enum(["user", "patient"]),
    userId: z.string().uuid({ message: "Invalid user ID format." }).optional(),
    patientId: z.string().uuid({ message: "Invalid patient ID format." }).optional(),
    appointmentId: z.string().uuid({ message: "Invalid appointment ID format." }).optional(),
    notificationType: z.string().min(1, { message: "Notification type is required." }).max(50),
    channel: z.enum(["sms", "email", "whatsapp", "in_app"]),
    message: z.string().min(1, { message: "Message is required." }),
  })
  .refine(
    (input) =>
      (input.recipientType === "user" && !!input.userId && !input.patientId) ||
      (input.recipientType === "patient" && !!input.patientId && !input.userId),
    { message: "recipientType must match exactly one of userId or patientId." }
  );

/**
 * Validation schema for the notification list query.
 */
export const notificationListQuerySchema = paginationSchema.extend({
  userId: z.string().uuid({ message: "Invalid user ID format." }).optional(),
  patientId: z.string().uuid({ message: "Invalid patient ID format." }).optional(),
  status: z.enum(["pending", "sent", "failed", "cancelled"]).optional(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;

export function validateCreateNotificationInput(input: unknown): CreateNotificationInput {
  return createNotificationSchema.parse(input);
}
