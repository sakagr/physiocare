import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Appointment } from "../repositories/appointment.repository";
import {
  insertAppointment,
  updateAppointment as persistAppointmentUpdate,
  findAppointmentById,
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
 * Pure transition-legality check, exported so appointment-workflow.service.ts
 * can fail fast before triggering a package-session side effect, without
 * duplicating this matrix.
 */
export function isLegalAppointmentStatusTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return LEGAL_APPOINTMENT_STATUS_TRANSITIONS[from].includes(to);
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

  return insertAppointment(supabase, {
    organization_id: caller.organization_id,
    patient_id: patient.id,
    clinic_id: clinic.id,
    physiotherapist_id: physiotherapist.id,
    appointment_time: input.appointmentTime,
    appointment_type: input.appointmentType,
    notes: input.notes || null,
    created_by: callerUserId,
  });
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

  return persistAppointmentUpdate(supabase, appointmentId, {
    appointment_time: input.appointmentTime,
    appointment_type: input.appointmentType,
    notes: input.notes !== undefined ? input.notes || null : undefined,
  });
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

  return persistAppointmentUpdate(supabase, appointmentId, { deleted_at: new Date().toISOString() });
}

/**
 * Fetches the details of an active appointment, scoped to the caller's role.
 */
export async function getAppointmentDetails(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  appointmentId: string
): Promise<Appointment> {
  const appointment = await findAppointmentById(supabase, appointmentId);
  if (!appointment) {
    throw new AppError("Appointment not found", ErrorCodes.NOT_FOUND);
  }

  const isAuthorized = await canAccessAppointment(supabase, callerUserId, appointmentId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  return appointment;
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
): Promise<PagedResult<Appointment>> {
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

  if (callerRole?.name === "ORG_PHYSIOTHERAPIST") {
    scopedFilters.physiotherapistId = callerUserId;
  } else if (callerRole?.name === "ORG_RECEPTIONIST") {
    const accessibleClinicIds = await getAccessibleClinicIds(supabase, callerUserId);
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

  return {
    items: appointments,
    total,
    page: filters.page,
    pageSize: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}
