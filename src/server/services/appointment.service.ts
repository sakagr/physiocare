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
import {
  canViewAppointments,
  canManageAppointments,
  canAccessAppointment,
  canDeleteAppointment,
  getAccessibleClinicIds,
  canOrganizationTransact,
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

  const isTransactable = await canOrganizationTransact(supabase, caller.organization_id);
  if (!isTransactable) {
    throw new AppError("Organization does not have an active subscription", ErrorCodes.SUBSCRIPTION_REQUIRED);
  }

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
