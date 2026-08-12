import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Notification } from "../repositories/notification.repository";
import {
  insertNotification,
  insertNotificationWithoutReturn,
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
 * Creates a notification record under **system authority**, for
 * orchestrations that must notify a patient without a caller who is
 * authorized to `createNotification` themselves (attendance-workflow.service.ts
 * is the first: `AGENTS.md:637` says "no caller initiates" a patient
 * notification, and this is what makes that true). No caller-authorization
 * check -- `organizationId` is supplied by the orchestration from an
 * already-resolved record (never from client input), which is what makes
 * omitting the check safe.
 *
 * Runs on the caller's **session client**, not the admin client:
 * `notifications_insert_policy` is org-scoped and admits an org member's own
 * session, so no admin authority is needed for the write itself (unlike the
 * appointment cancel/read this is paired with in the workflow -- see
 * cancelAppointmentAsSystem's doc comment).
 *
 * **Deliberately returns nothing**, unlike `createNotification` -- a policy
 * consequence, not an oversight. `notifications_select_policy` is narrower
 * than the insert policy (recipient-self, ORG_ADMIN, or SUPER_ADMIN), so a
 * physiotherapist's or receptionist's session can insert a patient
 * notification but cannot read it back in the same statement; asking for it
 * would turn a successful write into an RLS error (`insertNotificationWithoutReturn`'s
 * doc comment has the full mechanism). This still **throws** on a genuine
 * failure -- callers that need the row's absence not to break other work use
 * `recordAuditLogSafe`-style swallowing themselves; this function's own
 * caller (the attendance workflow) relies on the throw to populate
 * `failedNotificationAppointmentIds`.
 *
 * Recipient validation (the patient exists and belongs to the organization)
 * is retained from `createNotification` -- that is domain correctness, not
 * authorization. It succeeds under a physiotherapist's or receptionist's own
 * session because `patients_select_policy` is org-wide for any member.
 */
export async function recordSystemNotification(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  input: CreateNotificationInput
): Promise<void> {
  if (input.recipientType === "user") {
    const recipient = await findUserById(supabase, input.userId!);
    if (!recipient || recipient.organization_id !== organizationId) {
      throw new AppError("Recipient user not found", ErrorCodes.NOT_FOUND);
    }
  } else {
    const recipient = await findPatientById(supabase, input.patientId!);
    if (!recipient || recipient.organization_id !== organizationId) {
      throw new AppError("Recipient patient not found", ErrorCodes.NOT_FOUND);
    }
  }

  await insertNotificationWithoutReturn(supabase, {
    organization_id: organizationId,
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
