import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Consultation } from "../repositories/consultation.repository";
import {
  insertConsultation,
  updateConsultation as persistConsultationUpdate,
  findConsultationById,
  findConsultationByAppointmentId,
  listConsultations,
  countConsultations,
} from "../repositories/consultation.repository";
import { findAppointmentById } from "../repositories/appointment.repository";
import { findUserById, findRoleById } from "../repositories/user.repository";
import { findAssignmentsByUser } from "../repositories/user-clinic.repository";
import {
  canViewConsultations,
  canManageConsultation,
  canAccessConsultation,
  canAccessAppointment,
  getAccessibleClinicIds,
  assertOrganizationCanTransact,
} from "./authorization.service";
import { recordAuditLogSafe } from "./audit-log.service";
import { AppError, ErrorCodes } from "../errors";
import type { PagedResult } from "../validators/shared.validator";
import type { CreateConsultationInput, UpdateConsultationInput } from "../validators/consultation.validator";

export interface ConsultationListFilters {
  page: number;
  limit: number;
  patientId?: string;
}

/**
 * Creates the consultation for an appointment (1:1). Re-validates that the
 * appointment's physiotherapist is still actively assigned to its clinic —
 * clinic assignments can change after the appointment was created, so this
 * is re-checked here rather than trusted from appointment creation.
 * patient_id and physiotherapist_id are copied from the appointment, never
 * taken from client input, to prevent spoofing.
 */
export async function createConsultation(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  input: CreateConsultationInput
): Promise<Consultation> {
  const isAuthorized = await canManageConsultation(supabase, callerUserId, input.appointmentId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const appointment = await findAppointmentById(supabase, input.appointmentId);
  if (!appointment) {
    throw new AppError("Appointment not found", ErrorCodes.NOT_FOUND);
  }

  // Anchored on the appointment's organization: this path never fetches the
  // caller, and canManageConsultation admits SUPER_ADMIN, which has none.
  await assertOrganizationCanTransact(supabase, appointment.organization_id);

  const existing = await findConsultationByAppointmentId(supabase, appointment.id);
  if (existing) {
    throw new AppError("A consultation already exists for this appointment", ErrorCodes.CONSULTATION_ALREADY_EXISTS);
  }

  const physiotherapistAssignments = await findAssignmentsByUser(supabase, appointment.organization_id, appointment.physiotherapist_id);
  if (!physiotherapistAssignments.some((assignment) => assignment.clinic_id === appointment.clinic_id)) {
    throw new AppError("Physiotherapist is no longer assigned to the appointment's clinic", ErrorCodes.FORBIDDEN);
  }

  const created = await insertConsultation(supabase, {
    organization_id: appointment.organization_id,
    appointment_id: appointment.id,
    patient_id: appointment.patient_id,
    physiotherapist_id: appointment.physiotherapist_id,
    symptoms: input.symptoms || null,
    pain_areas: input.painAreas ?? [],
    pain_scale: input.painScale ?? null,
    diagnosis_notes: input.diagnosisNotes || null,
    followup_notes: input.followupNotes || null,
  });

  await recordAuditLogSafe(supabase, {
    organizationId: created.organization_id,
    userId: callerUserId,
    action: "create",
    entityName: "consultations",
    entityId: created.id,
    newData: created,
  });

  return created;
}

/**
 * Updates an existing consultation. The referenced appointment cannot be changed.
 */
export async function updateConsultation(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  consultationId: string,
  input: UpdateConsultationInput
): Promise<Consultation> {
  const consultation = await findConsultationById(supabase, consultationId);
  if (!consultation) {
    throw new AppError("Consultation not found", ErrorCodes.NOT_FOUND);
  }

  const isAuthorized = await canManageConsultation(supabase, callerUserId, consultation.appointment_id);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  // Resource-anchored for the same reason as createConsultation, above.
  await assertOrganizationCanTransact(supabase, consultation.organization_id);

  const updated = await persistConsultationUpdate(supabase, consultationId, {
    symptoms: input.symptoms !== undefined ? input.symptoms || null : undefined,
    pain_areas: input.painAreas !== undefined ? input.painAreas : undefined,
    pain_scale: input.painScale !== undefined ? input.painScale ?? null : undefined,
    diagnosis_notes: input.diagnosisNotes !== undefined ? input.diagnosisNotes || null : undefined,
    followup_notes: input.followupNotes !== undefined ? input.followupNotes || null : undefined,
  });

  await recordAuditLogSafe(supabase, {
    organizationId: consultation.organization_id,
    userId: callerUserId,
    action: "update",
    entityName: "consultations",
    entityId: consultation.id,
    oldData: consultation,
    newData: updated,
  });

  return updated;
}

/**
 * Fetches the details of a consultation, scoped to the caller's role.
 */
export async function getConsultationDetails(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  consultationId: string
): Promise<Consultation> {
  const consultation = await findConsultationById(supabase, consultationId);
  if (!consultation) {
    throw new AppError("Consultation not found", ErrorCodes.NOT_FOUND);
  }

  const isAuthorized = await canAccessConsultation(supabase, callerUserId, consultationId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  return consultation;
}

/**
 * Fetches the consultation recorded for an appointment, or `null` if the
 * visit has not been recorded yet (F6, D5).
 *
 * **`null` is a success, not a 404.** The consultation destination is routed
 * by appointment id and must decide between the create form and the edit form
 * before it can render anything; "not started yet" is the *normal* state
 * there, and a 404 would route the client into the not-found frame per
 * `UX.md`'s error table. The alternatives both cost more: creating blind and
 * catching `CONSULTATION_ALREADY_EXISTS` is 409-as-control-flow and still
 * cannot fetch the existing row, and filtering the list endpoint by patient
 * over-fetches to answer a singleton question.
 *
 * Authorized on the **appointment's** read boundary rather than the
 * consultation's: a caller who may see the appointment must be able to learn
 * that it has no consultation, and when one exists the two boundaries agree
 * anyway -- `canAccessConsultation` resolves a receptionist through that same
 * appointment's clinic.
 */
export async function getConsultationForAppointment(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  appointmentId: string
): Promise<Consultation | null> {
  const appointment = await findAppointmentById(supabase, appointmentId);
  if (!appointment) {
    throw new AppError("Appointment not found", ErrorCodes.NOT_FOUND);
  }

  const isAuthorized = await canAccessAppointment(supabase, callerUserId, appointmentId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  return findConsultationByAppointmentId(supabase, appointmentId);
}

/**
 * Lists organization consultations with pagination support, scoped to the
 * caller's role: ORG_OWNER/ORG_ADMIN see all consultations,
 * ORG_RECEPTIONIST is restricted to accessible clinics, and
 * ORG_PHYSIOTHERAPIST is restricted to their own consultations.
 */
export async function listOrganizationConsultations(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  filters: ConsultationListFilters
): Promise<PagedResult<Consultation>> {
  const isAuthorized = await canViewConsultations(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const callerRole = await findRoleById(supabase, caller.role_id);
  const scopedFilters: ConsultationListFilters & { physiotherapistId?: string; clinicIds?: string[] } = { ...filters };

  if (callerRole?.name === "ORG_PHYSIOTHERAPIST") {
    scopedFilters.physiotherapistId = callerUserId;
  } else if (callerRole?.name === "ORG_RECEPTIONIST") {
    const accessibleClinicIds = await getAccessibleClinicIds(supabase, callerUserId);
    if (accessibleClinicIds.length === 0) {
      return { items: [], total: 0, page: filters.page, pageSize: filters.limit, totalPages: 0 };
    }
    scopedFilters.clinicIds = accessibleClinicIds;
  }

  const consultations = await listConsultations(supabase, caller.organization_id, scopedFilters);
  const total = await countConsultations(supabase, caller.organization_id, scopedFilters);

  return {
    items: consultations,
    total,
    page: filters.page,
    pageSize: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}
