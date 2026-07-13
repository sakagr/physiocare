import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Notification } from "../repositories/notification.repository";
import {
  insertNotification,
  findNotificationById,
  listNotifications,
  countNotifications,
} from "../repositories/notification.repository";
import { findUserById, findRoleById } from "../repositories/user.repository";
import { findPatientById } from "../repositories/patient.repository";
import { canViewNotification, canManageNotifications } from "./authorization.service";
import { AppError, ErrorCodes } from "../errors";
import type { PagedResult } from "../validators/shared.validator";
import type { CreateNotificationInput } from "../validators/notification.validator";

/**
 * Creates a notification record. Persistence only in this phase -- no
 * SMS/email/WhatsApp dispatch integration; the record is inserted with
 * status 'pending' and never stamped with sent_at.
 */
export async function createNotification(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  input: CreateNotificationInput
): Promise<Notification> {
  const isAuthorized = await canManageNotifications(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  if (input.recipientType === "user") {
    const recipient = await findUserById(supabase, input.userId!);
    if (!recipient || recipient.organization_id !== caller.organization_id) {
      throw new AppError("Recipient user not found", ErrorCodes.NOT_FOUND);
    }
  } else {
    const recipient = await findPatientById(supabase, input.patientId!);
    if (!recipient || recipient.organization_id !== caller.organization_id) {
      throw new AppError("Recipient patient not found", ErrorCodes.NOT_FOUND);
    }
  }

  return insertNotification(supabase, {
    organization_id: caller.organization_id,
    recipient_type: input.recipientType,
    user_id: input.recipientType === "user" ? input.userId : null,
    patient_id: input.recipientType === "patient" ? input.patientId : null,
    appointment_id: input.appointmentId ?? null,
    notification_type: input.notificationType,
    channel: input.channel,
    message: input.message,
    status: "pending",
  });
}

/**
 * Fetches the details of an active notification.
 */
export async function getNotificationDetails(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  notificationId: string
): Promise<Notification> {
  const notification = await findNotificationById(supabase, notificationId);
  if (!notification) {
    throw new AppError("Notification not found", ErrorCodes.NOT_FOUND);
  }

  const isAuthorized = await canViewNotification(supabase, callerUserId, notification);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  return notification;
}

/**
 * Lists notifications with pagination.
 * - ORG_OWNER/ORG_ADMIN: org-wide.
 * - Everyone else: their own (user_id = caller) only.
 */
export async function listOrganizationNotifications(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  filters: {
    page: number;
    limit: number;
    userId?: string;
    patientId?: string;
    status?: Database["public"]["Enums"]["notification_status"];
  }
): Promise<PagedResult<Notification>> {
  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const roleRecord = await findRoleById(supabase, caller.role_id);
  const isManager = roleRecord?.name === "ORG_OWNER" || roleRecord?.name === "ORG_ADMIN" || roleRecord?.name === "SUPER_ADMIN";

  const effectiveFilters = isManager ? filters : { ...filters, userId: callerUserId };

  const items = await listNotifications(supabase, caller.organization_id, effectiveFilters);
  const total = await countNotifications(supabase, caller.organization_id, effectiveFilters);

  return {
    items,
    total,
    page: filters.page,
    pageSize: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}
