import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Appointment, AppointmentWithDisplay } from "../repositories/appointment.repository";
import {
  insertAppointment,
  updateAppointment as persistAppointmentUpdate,
  findAppointmentById,
  findAppointmentWithDisplayById,
  listAppointments,
  countAppointments,
} from "../repositories/appointment.repository";
import { insertAppointmentStatusLog } from "../repositories/appointment-status-log.repository";
import { findPatientById } from "../repositories/patient.repository";
import { findClinicById } from "../repositories/clinic.repository";
import { findUserById, findRoleById } from "../repositories/user.repository";
import { findAssignmentsByUser } from "../repositories/user-clinic.repository";
import { findAttendanceByUserAndDate } from "../repositories/attendance.repository";
import {
  canViewAppointments,
  canManageAppointments,
  canAccessAppointment,
  canDeleteAppointment,
  getAccessibleClinicIds,
  assertOrganizationCanTransact,
} from "./authorization.service";
import { recordAuditLogSafe } from "./audit-log.service";
import { AppError, ErrorCodes } from "../errors";
import type { PagedResult } from "../validators/shared.validator";
import type { CreateAppointmentInput, UpdateAppointmentInput, UpdateAppointmentStatusInput } from "../validators/appointment.validator";

type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];

/**
 * Legal appointment status transitions. completed -> cancelled is the only
 * reversal path (an administrative correction, e.g. an appointment marked
 * complete by mistake); every other terminal state (cancelled, no_show) is
 * final.
 */
const LEGAL_APPOINTMENT_STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled: ["confirmed", "checked_in", "cancelled", "no_show"],
  confirmed: ["checked_in", "cancelled", "no_show"],
  checked_in: ["completed", "cancelled"],
  completed: ["cancelled"],
  cancelled: [],
  no_show: [],
};

/**
 * Audit verb per target status (F6, D15). Domain verbs, not `update`: a
 * lifecycle transition and a field edit must be tellable apart by action
 * alone, so an auditor filtering `entityName = appointments` never has to
 * diff snapshots to find out which happened.
 */
const STATUS_AUDIT_ACTIONS: Record<AppointmentStatus, string> = {
  scheduled: "reschedule",
  confirmed: "confirm",
  checked_in: "check_in",
  completed: "complete",
  cancelled: "cancel",
  no_show: "no_show",
};

/**
 * Pure transition-legality check, exported so appointment-workflow.service.ts
 * can fail fast before triggering a package-session side effect, without
 * duplicating this matrix.
 */
export function isLegalAppointmentStatusTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return LEGAL_APPOINTMENT_STATUS_TRANSITIONS[from].includes(to);
}

/**
 * Per-item permission hints on an appointment read (F6, D13; ADR-0010).
 *
 * `allowedTransitions` carries both facts that decide whether to render a
 * status control -- may this caller act on this row, and is the transition
 * legal from its current status -- so the client renders one control per
 * element and holds no copy of the transition matrix. A `canManage: boolean`
 * would have carried only the first, forcing the matrix to be mirrored
 * client-side where it would drift silently.
 *
 * Advisory only: `canAccessAppointment`, `canManageConsultation` and the
 * matrix itself remain the security boundary, unchanged by these fields.
 */
export interface AppointmentHints {
  allowedTransitions: AppointmentStatus[];
  /** Also governs the prescription section -- see `resolveAppointmentHints`. */
  canManageConsultation: boolean;
}

export type AppointmentReadModel = AppointmentWithDisplay & AppointmentHints;

/**
 * The caller facts every hint on a page is computed from, resolved **once**
 * per request rather than per row.
 *
 * `canAccessAppointment` costs two to three lookups per call, so calling it
 * per row would be an N+1 of 50-75 queries over a page of 25. This mirrors
 * `listOrganizationUsers`'s shape (`user.service.ts`), which resolves the
 * caller's role once and derives `canManage` in memory for the same reason.
 */
interface HintContext {
  callerUserId: string;
  roleName: string | undefined;
  /** Resolved only for a receptionist; nobody else's access depends on it. */
  accessibleClinicIds: string[];
}

async function resolveHintContext(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  roleName: string | undefined
): Promise<HintContext> {
  const accessibleClinicIds =
    roleName === "ORG_RECEPTIONIST" ? await getAccessibleClinicIds(supabase, callerUserId) : [];
  return { callerUserId, roleName, accessibleClinicIds };
}

/**
 * In-memory mirror of `canAccessAppointment`, evaluated against a row already
 * in hand.
 *
 * **This conjunct cannot currently return false for a row the caller was
 * listed** -- `listOrganizationAppointments` and `canAccessAppointment`
 * partition the organization identically, role for role, and
 * `getAppointmentDetails` returns 403 before any hint is computed. It is kept
 * deliberately rather than simplified away: that agreement is not stable. F5
 * widened Reception from clinic-scoped to organization-wide for patients and
 * patient records, in both the predicate and RLS, when the narrower scoping
 * made Flow 4 impossible for its own primary actor -- appointments are the
 * same shape and the same role. The day the listing is widened without the
 * predicate, this is what stops the UI offering actions the server refuses.
 *
 * The invariant that makes it redundant today is asserted, in that one
 * direction only, by "never lists a row the caller may not act on, for any
 * role" in `tests/integration/appointments.test.ts`. If that test fails, this
 * conjunct has started doing real work.
 */
function callerCanAccess(appointment: Appointment, context: HintContext): boolean {
  if (context.roleName === "SUPER_ADMIN") return true;
  if (context.roleName === "ORG_OWNER" || context.roleName === "ORG_ADMIN") return true;
  if (appointment.physiotherapist_id === context.callerUserId) return true;
  if (context.roleName === "ORG_RECEPTIONIST") {
    return context.accessibleClinicIds.includes(appointment.clinic_id);
  }
  return false;
}

/**
 * Computes both hints for one row. `canManageConsultation` mirrors the
 * predicate of the same name and **also governs the prescription section**
 * (D14): `canManagePrescription` keys on the consultation, but a
 * consultation's `physiotherapist_id` is copied from its appointment at
 * create and no input shape can change it afterwards, so the two predicates
 * agree for every consultation reachable from this row. Pinned by
 * "agrees between canManageConsultation and canManagePrescription for every
 * role" in `tests/integration/consultations.test.ts`.
 */
function resolveAppointmentHints(appointment: Appointment, context: HintContext): AppointmentHints {
  const canManageConsultation =
    context.roleName === "SUPER_ADMIN" ||
    context.roleName === "ORG_OWNER" ||
    context.roleName === "ORG_ADMIN" ||
    appointment.physiotherapist_id === context.callerUserId;

  return {
    allowedTransitions: callerCanAccess(appointment, context)
      ? LEGAL_APPOINTMENT_STATUS_TRANSITIONS[appointment.status]
      : [],
    canManageConsultation,
  };
}

/**
 * Blocks booking/rescheduling against a physiotherapist marked
 * absent/leave/half_day for the appointment's date.
 *
 * UTC convention, deliberately not fixed: `attendance_date` is a `date` and
 * `appointment_time` is `timestamptz`, and no organization timezone column
 * exists (1100_table_organizations.sql). Both the date and the half_day
 * window comparison resolve against the appointment's UTC calendar date and
 * UTC clock time -- the same convention `recordCheckIn` already uses for its
 * default date. Wrong near midnight or a window edge for a non-UTC
 * organization; the fix (an organization timezone column) is a schema-wide
 * concern left outside this feature.
 *
 * A validation read, not an orchestration -- this module already reads
 * patient/clinic/user/user-clinic tables for the same purpose. Deliberately
 * not clinic-scoped: unavailability is organization-wide, not per clinic --
 * the partial unique index on (organization_id, user_id, attendance_date)
 * permits only one live attendance row per person per day, so a
 * "unavailable at clinic A, available at clinic B" state cannot exist.
 */
async function assertPhysiotherapistAvailable(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  physiotherapistId: string,
  appointmentTime: string
): Promise<void> {
  const isoTime = new Date(appointmentTime).toISOString();
  const date = isoTime.slice(0, 10);
  const clockTime = isoTime.slice(11, 19);

  const attendance = await findAttendanceByUserAndDate(supabase, organizationId, physiotherapistId, date);
  if (!attendance) return;

  const isUnavailable =
    attendance.status === "absent" ||
    attendance.status === "leave" ||
    (attendance.status === "half_day" &&
      attendance.unavailable_from !== null &&
      attendance.unavailable_to !== null &&
      clockTime >= attendance.unavailable_from &&
      clockTime < attendance.unavailable_to);

  if (isUnavailable) {
    throw new AppError("This physiotherapist isn't available at that time.", ErrorCodes.PHYSIOTHERAPIST_UNAVAILABLE);
  }
}

export interface AppointmentListFilters {
  page: number;
  limit: number;
  patientId?: string;
  clinicId?: string;
  physiotherapistId?: string;
  status?: Database["public"]["Enums"]["appointment_status"];
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Creates a new appointment. Validates that the patient, clinic, and
 * physiotherapist belong to the caller's organization, that the clinic is
 * active, and that the physiotherapist is actively assigned to that clinic.
 */
export async function createAppointment(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  input: CreateAppointmentInput
): Promise<Appointment> {
  const isAuthorized = await canManageAppointments(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  await assertOrganizationCanTransact(supabase, caller.organization_id);

  const patient = await findPatientById(supabase, input.patientId);
  if (!patient || patient.organization_id !== caller.organization_id) {
    throw new AppError("Patient not found", ErrorCodes.NOT_FOUND);
  }

  const clinic = await findClinicById(supabase, input.clinicId);
  if (!clinic || clinic.organization_id !== caller.organization_id) {
    throw new AppError("Clinic not found", ErrorCodes.NOT_FOUND);
  }
  if (!clinic.is_active) {
    throw new AppError("Cannot schedule an appointment at an inactive clinic", ErrorCodes.FORBIDDEN);
  }

  const callerRole = await findRoleById(supabase, caller.role_id);
  if (callerRole?.name === "ORG_RECEPTIONIST") {
    const accessibleClinicIds = await getAccessibleClinicIds(supabase, callerUserId);
    if (!accessibleClinicIds.includes(clinic.id)) {
      throw new AppError("Forbidden: Scoping violation on clinic", ErrorCodes.FORBIDDEN);
    }
  }

  const physiotherapist = await findUserById(supabase, input.physiotherapistId);
  if (!physiotherapist || physiotherapist.deleted_at || physiotherapist.organization_id !== caller.organization_id) {
    throw new AppError("Physiotherapist not found", ErrorCodes.NOT_FOUND);
  }

  const physiotherapistRole = await findRoleById(supabase, physiotherapist.role_id);
  if (physiotherapistRole?.name !== "ORG_PHYSIOTHERAPIST") {
    throw new AppError("Target user is not a physiotherapist", ErrorCodes.FORBIDDEN);
  }

  const physiotherapistAssignments = await findAssignmentsByUser(supabase, caller.organization_id, physiotherapist.id);
  if (!physiotherapistAssignments.some((assignment) => assignment.clinic_id === clinic.id)) {
    throw new AppError("Physiotherapist is not assigned to the target clinic", ErrorCodes.FORBIDDEN);
  }

  await assertPhysiotherapistAvailable(supabase, caller.organization_id, physiotherapist.id, input.appointmentTime);

  const created = await insertAppointment(supabase, {
    organization_id: caller.organization_id,
    patient_id: patient.id,
    clinic_id: clinic.id,
    physiotherapist_id: physiotherapist.id,
    appointment_time: input.appointmentTime,
    appointment_type: input.appointmentType,
    notes: input.notes || null,
    created_by: callerUserId,
  });

  await recordAuditLogSafe(supabase, {
    organizationId: created.organization_id,
    userId: callerUserId,
    action: "create",
    entityName: "appointments",
    entityId: created.id,
    newData: created,
  });

  return created;
}

/**
 * Updates an appointment's scheduling details (time/type/notes only).
 * Patient, clinic, and physiotherapist cannot be reassigned; cancel and
 * recreate the appointment instead.
 */
export async function updateAppointment(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  appointmentId: string,
  input: UpdateAppointmentInput
): Promise<Appointment> {
  const appointment = await findAppointmentById(supabase, appointmentId);
  if (!appointment) {
    throw new AppError("Appointment not found", ErrorCodes.NOT_FOUND);
  }

  const isAuthorized = await canAccessAppointment(supabase, callerUserId, appointmentId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  // Anchored on the appointment's organization, not the caller's: this path
  // never fetches the caller, and canAccessAppointment admits SUPER_ADMIN,
  // which has no organization of its own.
  await assertOrganizationCanTransact(supabase, appointment.organization_id);

  // Re-checked against the destination time only, and only when the time is
  // actually changing -- an edit to type or notes alone re-checks nothing.
  // Without this, the create-time block is trivially bypassed: book outside
  // the window, then reschedule into it (D-J). The physiotherapist is taken
  // from the existing row; reassigning them is not permitted here.
  if (input.appointmentTime !== undefined) {
    await assertPhysiotherapistAvailable(
      supabase,
      appointment.organization_id,
      appointment.physiotherapist_id,
      input.appointmentTime
    );
  }

  const updated = await persistAppointmentUpdate(supabase, appointmentId, {
    appointment_time: input.appointmentTime,
    appointment_type: input.appointmentType,
    notes: input.notes !== undefined ? input.notes || null : undefined,
  });

  await recordAuditLogSafe(supabase, {
    organizationId: appointment.organization_id,
    userId: callerUserId,
    action: "update",
    entityName: "appointments",
    entityId: appointment.id,
    oldData: appointment,
    newData: updated,
  });

  return updated;
}

/**
 * Transitions an appointment's status. Only transitions in
 * LEGAL_APPOINTMENT_STATUS_TRANSITIONS are allowed; every accepted
 * transition is recorded in appointment_status_logs.
 */
export async function updateAppointmentStatus(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  appointmentId: string,
  input: UpdateAppointmentStatusInput
): Promise<Appointment> {
  const appointment = await findAppointmentById(supabase, appointmentId);
  if (!appointment) {
    throw new AppError("Appointment not found", ErrorCodes.NOT_FOUND);
  }

  const isAuthorized = await canAccessAppointment(supabase, callerUserId, appointmentId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  // Resource-anchored for the same reason as updateAppointment, above.
  await assertOrganizationCanTransact(supabase, appointment.organization_id);

  if (!isLegalAppointmentStatusTransition(appointment.status, input.status)) {
    throw new AppError(
      `Cannot transition an appointment from ${appointment.status} to ${input.status}`,
      ErrorCodes.INVALID_APPOINTMENT_STATUS_TRANSITION
    );
  }

  const previousStatus = appointment.status;
  const updated = await persistAppointmentUpdate(supabase, appointmentId, { status: input.status });

  // The target status is the audit verb, not a generic `update`: a lifecycle
  // transition and a field edit must be distinguishable by action alone
  // (AGENTS.md -> Audit Logging). `transitionAppointmentStatus` delegates
  // here rather than writing its own entry, so a workflow-driven transition
  // produces exactly one.
  await recordAuditLogSafe(supabase, {
    organizationId: appointment.organization_id,
    userId: callerUserId,
    action: STATUS_AUDIT_ACTIONS[input.status],
    entityName: "appointments",
    entityId: appointment.id,
    oldData: appointment,
    newData: updated,
  });

  await insertAppointmentStatusLog(supabase, {
    organization_id: appointment.organization_id,
    appointment_id: appointment.id,
    old_status: previousStatus,
    new_status: input.status,
    changed_by: callerUserId,
  });

  return updated;
}

/** Statuses an availability auto-cancel may act on. See D-D. */
const AUTO_CANCEL_ELIGIBLE_STATUSES: AppointmentStatus[] = ["scheduled", "confirmed"];

/**
 * Cancels an appointment under **system authority**, for the availability
 * auto-cancel workflow (attendance-workflow.service.ts). Takes only the
 * admin client -- it is entirely a system act, not authorized by any
 * caller's own access to the appointment. Cancelling through
 * `updateAppointmentStatus`'s `canAccessAppointment` check would make the
 * feature's effect depend on who recorded the absence: a receptionist would
 * clear only appointments at clinics she is assigned to, both at the
 * service layer and under `appointments_update_policy` in RLS, leaving a
 * schedule half-cleared with no patient notification written. This function
 * (and the listing that feeds it) run on the admin client precisely to
 * avoid that.
 *
 * System authority is about what may be written, not about hiding who
 * triggered it: the status log still records `changed_by` as the user who
 * recorded the absence.
 *
 * Never routes through `transitionAppointmentStatus` -- no package session
 * can ever be consumed or reversed by an availability cancel. The eligible-
 * status check is enforced here independently of the orchestration's own
 * filter (D-D), so "an availability cancel can never touch a completed
 * visit" is structural rather than a caller convention.
 */
export async function cancelAppointmentAsSystem(
  adminClient: SupabaseClient<Database>,
  organizationId: string,
  appointmentId: string,
  changedByUserId: string
): Promise<Appointment> {
  await assertOrganizationCanTransact(adminClient, organizationId);

  const appointment = await findAppointmentById(adminClient, appointmentId);
  if (!appointment || appointment.organization_id !== organizationId) {
    throw new AppError("Appointment not found", ErrorCodes.NOT_FOUND);
  }

  if (!AUTO_CANCEL_ELIGIBLE_STATUSES.includes(appointment.status)) {
    throw new AppError(
      `Cannot auto-cancel an appointment in status ${appointment.status}`,
      ErrorCodes.INVALID_APPOINTMENT_STATUS_TRANSITION
    );
  }

  const previousStatus = appointment.status;
  const updated = await persistAppointmentUpdate(adminClient, appointmentId, { status: "cancelled" });

  // `auto_cancel`, deliberately distinct from a person's `cancel`. "Was this
  // cancelled by someone or by the availability workflow?" is the first
  // question asked of a cancelled appointment, and `changed_by` cannot answer
  // it -- the status log records the user who marked the absence either way.
  await recordAuditLogSafe(adminClient, {
    organizationId: appointment.organization_id,
    userId: changedByUserId,
    action: "auto_cancel",
    entityName: "appointments",
    entityId: appointment.id,
    oldData: appointment,
    newData: updated,
  });

  await insertAppointmentStatusLog(adminClient, {
    organization_id: appointment.organization_id,
    appointment_id: appointment.id,
    old_status: previousStatus,
    new_status: "cancelled",
    changed_by: changedByUserId,
  });

  return updated;
}

/**
 * Soft-deletes an appointment. An administrative correction path, distinct
 * from the status = 'cancelled' business state.
 */
export async function deleteAppointment(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  appointmentId: string
): Promise<Appointment> {
  const isAuthorized = await canDeleteAppointment(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  await assertOrganizationCanTransact(supabase, caller.organization_id);

  const appointment = await findAppointmentById(supabase, appointmentId);
  if (!appointment) {
    throw new AppError("Appointment not found", ErrorCodes.NOT_FOUND);
  }

  if (appointment.organization_id !== caller.organization_id) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  const deleted = await persistAppointmentUpdate(supabase, appointmentId, {
    deleted_at: new Date().toISOString(),
  });

  await recordAuditLogSafe(supabase, {
    organizationId: appointment.organization_id,
    userId: callerUserId,
    action: "delete",
    entityName: "appointments",
    entityId: appointment.id,
    oldData: appointment,
  });

  return deleted;
}

/**
 * Fetches the details of an active appointment, scoped to the caller's role,
 * with its display projection (D1). A read, so it carries the projection;
 * the write paths return the bare row (D12).
 */
export async function getAppointmentDetails(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  appointmentId: string
): Promise<AppointmentReadModel> {
  const appointment = await findAppointmentWithDisplayById(supabase, appointmentId);
  if (!appointment) {
    throw new AppError("Appointment not found", ErrorCodes.NOT_FOUND);
  }

  const isAuthorized = await canAccessAppointment(supabase, callerUserId, appointmentId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  const callerRole = caller ? await findRoleById(supabase, caller.role_id) : null;
  const context = await resolveHintContext(supabase, callerUserId, callerRole?.name);

  return { ...appointment, ...resolveAppointmentHints(appointment, context) };
}

/**
 * Lists organization appointments with search, filter, and pagination
 * support, scoped to the caller's role: ORG_OWNER/ORG_ADMIN see all
 * appointments, ORG_RECEPTIONIST is restricted to accessible clinics, and
 * ORG_PHYSIOTHERAPIST is restricted to their own appointments.
 */
export async function listOrganizationAppointments(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  filters: AppointmentListFilters
): Promise<PagedResult<AppointmentReadModel>> {
  const isAuthorized = await canViewAppointments(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const callerRole = await findRoleById(supabase, caller.role_id);
  const scopedFilters: AppointmentListFilters & { clinicIds?: string[] } = { ...filters };

  // Resolved once, and reused as the hint context below rather than looked up
  // a second time per page.
  const accessibleClinicIds =
    callerRole?.name === "ORG_RECEPTIONIST" ? await getAccessibleClinicIds(supabase, callerUserId) : [];

  if (callerRole?.name === "ORG_PHYSIOTHERAPIST") {
    scopedFilters.physiotherapistId = callerUserId;
  } else if (callerRole?.name === "ORG_RECEPTIONIST") {
    if (filters.clinicId) {
      if (!accessibleClinicIds.includes(filters.clinicId)) {
        return { items: [], total: 0, page: filters.page, pageSize: filters.limit, totalPages: 0 };
      }
    } else {
      if (accessibleClinicIds.length === 0) {
        return { items: [], total: 0, page: filters.page, pageSize: filters.limit, totalPages: 0 };
      }
      scopedFilters.clinicIds = accessibleClinicIds;
    }
  }

  const appointments = await listAppointments(supabase, caller.organization_id, scopedFilters);
  const total = await countAppointments(supabase, caller.organization_id, scopedFilters);

  // In-memory per row: no predicate call per appointment, and no query inside
  // this loop (see `resolveHintContext`).
  const context: HintContext = { callerUserId, roleName: callerRole?.name, accessibleClinicIds };

  return {
    items: appointments.map((appointment) => ({
      ...appointment,
      ...resolveAppointmentHints(appointment, context),
    })),
    total,
    page: filters.page,
    pageSize: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}
