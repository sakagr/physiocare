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
  getAccessibleClinicIds,
} from "./authorization.service";
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

  const existing = await findConsultationByAppointmentId(supabase, appointment.id);
  if (existing) {
    throw new AppError("A consultation already exists for this appointment", ErrorCodes.CONSULTATION_ALREADY_EXISTS);
  }

  const physiotherapistAssignments = await findAssignmentsByUser(supabase, appointment.organization_id, appointment.physiotherapist_id);
  if (!physiotherapistAssignments.some((assignment) => assignment.clinic_id === appointment.clinic_id)) {
    throw new AppError("Physiotherapist is no longer assigned to the appointment's clinic", ErrorCodes.FORBIDDEN);
  }

  return insertConsultation(supabase, {
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

  return persistConsultationUpdate(supabase, consultationId, {
    symptoms: input.symptoms !== undefined ? input.symptoms || null : undefined,
    pain_areas: input.painAreas !== undefined ? input.painAreas : undefined,
    pain_scale: input.painScale !== undefined ? input.painScale ?? null : undefined,
    diagnosis_notes: input.diagnosisNotes !== undefined ? input.diagnosisNotes || null : undefined,
    followup_notes: input.followupNotes !== undefined ? input.followupNotes || null : undefined,
  });
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
