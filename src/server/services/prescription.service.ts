import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Prescription } from "../repositories/prescription.repository";
import {
  insertPrescription,
  updatePrescription as persistPrescriptionUpdate,
  findPrescriptionById,
  listPrescriptions,
  countPrescriptions,
} from "../repositories/prescription.repository";
import { findConsultationById } from "../repositories/consultation.repository";
import { findUserById, findRoleById } from "../repositories/user.repository";
import {
  canViewPrescriptions,
  canManagePrescription,
  canAccessPrescription,
  getAccessibleClinicIds,
  assertOrganizationCanTransact,
} from "./authorization.service";
import { AppError, ErrorCodes } from "../errors";
import type { PagedResult } from "../validators/shared.validator";
import type { CreatePrescriptionInput, UpdatePrescriptionInput } from "../validators/prescription.validator";

export interface PrescriptionListFilters {
  page: number;
  limit: number;
  patientId?: string;
  consultationId?: string;
}

/**
 * Creates a prescription for a consultation. patient_id and
 * physiotherapist_id are copied from the consultation, never taken from
 * client input, to prevent spoofing. Prescriptions are not 1:1 with a
 * consultation — multiple prescriptions per consultation are allowed.
 */
export async function createPrescription(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  input: CreatePrescriptionInput
): Promise<Prescription> {
  const isAuthorized = await canManagePrescription(supabase, callerUserId, input.consultationId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const consultation = await findConsultationById(supabase, input.consultationId);
  if (!consultation) {
    throw new AppError("Consultation not found", ErrorCodes.NOT_FOUND);
  }

  // Anchored on the consultation's organization: this path never fetches the
  // caller, and canManagePrescription admits SUPER_ADMIN, which has none.
  await assertOrganizationCanTransact(supabase, consultation.organization_id);

  return insertPrescription(supabase, {
    organization_id: consultation.organization_id,
    consultation_id: consultation.id,
    patient_id: consultation.patient_id,
    physiotherapist_id: consultation.physiotherapist_id,
    advice: input.advice || null,
    followup_date: input.followupDate || null,
  });
}

/**
 * Updates an existing prescription. The referenced consultation cannot be changed.
 */
export async function updatePrescription(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  prescriptionId: string,
  input: UpdatePrescriptionInput
): Promise<Prescription> {
  const prescription = await findPrescriptionById(supabase, prescriptionId);
  if (!prescription) {
    throw new AppError("Prescription not found", ErrorCodes.NOT_FOUND);
  }

  const isAuthorized = await canManagePrescription(supabase, callerUserId, prescription.consultation_id);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  // Resource-anchored for the same reason as createPrescription, above.
  await assertOrganizationCanTransact(supabase, prescription.organization_id);

  return persistPrescriptionUpdate(supabase, prescriptionId, {
    advice: input.advice !== undefined ? input.advice || null : undefined,
    followup_date: input.followupDate !== undefined ? input.followupDate || null : undefined,
  });
}

/**
 * Fetches the details of a prescription, scoped to the caller's role.
 */
export async function getPrescriptionDetails(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  prescriptionId: string
): Promise<Prescription> {
  const prescription = await findPrescriptionById(supabase, prescriptionId);
  if (!prescription) {
    throw new AppError("Prescription not found", ErrorCodes.NOT_FOUND);
  }

  const isAuthorized = await canAccessPrescription(supabase, callerUserId, prescriptionId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  return prescription;
}

/**
 * Lists organization prescriptions with pagination support, scoped to the
 * caller's role: ORG_OWNER/ORG_ADMIN see all prescriptions,
 * ORG_RECEPTIONIST is restricted to accessible clinics, and
 * ORG_PHYSIOTHERAPIST is restricted to their own prescriptions.
 */
export async function listOrganizationPrescriptions(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  filters: PrescriptionListFilters
): Promise<PagedResult<Prescription>> {
  const isAuthorized = await canViewPrescriptions(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const callerRole = await findRoleById(supabase, caller.role_id);
  const scopedFilters: PrescriptionListFilters & { physiotherapistId?: string; clinicIds?: string[] } = { ...filters };

  if (callerRole?.name === "ORG_PHYSIOTHERAPIST") {
    scopedFilters.physiotherapistId = callerUserId;
  } else if (callerRole?.name === "ORG_RECEPTIONIST") {
    const accessibleClinicIds = await getAccessibleClinicIds(supabase, callerUserId);
    if (accessibleClinicIds.length === 0) {
      return { items: [], total: 0, page: filters.page, pageSize: filters.limit, totalPages: 0 };
    }
    scopedFilters.clinicIds = accessibleClinicIds;
  }

  const prescriptions = await listPrescriptions(supabase, caller.organization_id, scopedFilters);
  const total = await countPrescriptions(supabase, caller.organization_id, scopedFilters);

  return {
    items: prescriptions,
    total,
    page: filters.page,
    pageSize: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}
