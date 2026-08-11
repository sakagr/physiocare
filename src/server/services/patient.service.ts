import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Patient, InsertPatient } from "../repositories/patient.repository";
import {
  insertPatient,
  updatePatient as persistPatientUpdate,
  findPatientById,
  findLatestPatientCodeInOrg,
  listPatients,
  countPatients,
} from "../repositories/patient.repository";
import { findUserById } from "../repositories/user.repository";
import { existsAppointmentForPatient } from "../repositories/appointment.repository";
import { existsConsultationForPatient } from "../repositories/consultation.repository";
import { existsPrescriptionForPatient } from "../repositories/prescription.repository";
import { existsPatientRecordForPatient } from "../repositories/patient-record.repository";
import { canViewPatients, canManagePatients, assertOrganizationCanTransact } from "./authorization.service";
import { recordAuditLogSafe } from "./audit-log.service";
import { AppError, ErrorCodes } from "../errors";
import type { PagedResult } from "../validators/shared.validator";
import type { CreatePatientInput, UpdatePatientInput } from "../validators/patient.validator";

const PATIENT_CODE_PREFIX = "PT-";
const PATIENT_CODE_DIGITS = 6;
const MAX_PATIENT_CODE_ATTEMPTS = 3;

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "23505";
}

/**
 * Generates the next sequential, immutable patient code for an organization.
 * Considers soft-deleted patients too, since codes must never be reused.
 */
async function generatePatientCode(
  supabase: SupabaseClient<Database>,
  organizationId: string
): Promise<string> {
  const latest = await findLatestPatientCodeInOrg(supabase, organizationId);
  const nextSequence = latest ? parseInt(latest.slice(PATIENT_CODE_PREFIX.length), 10) + 1 : 1;
  return `${PATIENT_CODE_PREFIX}${String(nextSequence).padStart(PATIENT_CODE_DIGITS, "0")}`;
}

/**
 * Checks whether any clinical record still references the patient.
 */
async function hasClinicalReferences(
  supabase: SupabaseClient<Database>,
  patientId: string
): Promise<boolean> {
  const [hasAppointments, hasConsultations, hasPrescriptions, hasRecords] = await Promise.all([
    existsAppointmentForPatient(supabase, patientId),
    existsConsultationForPatient(supabase, patientId),
    existsPrescriptionForPatient(supabase, patientId),
    existsPatientRecordForPatient(supabase, patientId),
  ]);

  return hasAppointments || hasConsultations || hasPrescriptions || hasRecords;
}

/**
 * Creates a new patient, generating its immutable patient code.
 */
export async function createPatient(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  input: CreatePatientInput
): Promise<Patient> {
  const isAuthorized = await canManagePatients(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  await assertOrganizationCanTransact(supabase, caller.organization_id);

  const payload: Omit<InsertPatient, "patient_code"> = {
    organization_id: caller.organization_id,
    full_name: input.fullName,
    gender: input.gender || null,
    dob: input.dob || null,
    phone: input.phone || null,
    email: input.email || null,
    address: input.address || null,
    emergency_contact: input.emergencyContact || null,
    created_by: callerUserId,
  };

  let patient: Patient | null = null;

  for (let attempt = 0; attempt < MAX_PATIENT_CODE_ATTEMPTS; attempt++) {
    const patientCode = await generatePatientCode(supabase, caller.organization_id);
    try {
      patient = await insertPatient(supabase, { ...payload, patient_code: patientCode });
      break;
    } catch (error) {
      if (!isUniqueViolation(error) || attempt === MAX_PATIENT_CODE_ATTEMPTS - 1) {
        throw error;
      }
    }
  }

  if (!patient) {
    throw new Error("Failed to generate a unique patient code");
  }

  // Deliberately outside the retry loop above: its catch treats any unique
  // violation as a patient-code collision and retries the insert, so a failure
  // from anything else in that block would create a second patient row.
  await recordAuditLogSafe(supabase, {
    organizationId: caller.organization_id,
    userId: callerUserId,
    action: "create",
    entityName: "patients",
    entityId: patient.id,
    newData: patient,
  });

  return patient;
}

/**
 * Updates a patient's demographic details. Scoped strictly to the organization.
 */
export async function updatePatient(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  patientId: string,
  input: UpdatePatientInput
): Promise<Patient> {
  const isAuthorized = await canManagePatients(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  await assertOrganizationCanTransact(supabase, caller.organization_id);

  const patient = await findPatientById(supabase, patientId);
  if (!patient) {
    throw new AppError("Patient not found", ErrorCodes.NOT_FOUND);
  }

  if (patient.organization_id !== caller.organization_id) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  const updated = await persistPatientUpdate(supabase, patientId, {
    full_name: input.fullName,
    gender: input.gender !== undefined ? input.gender || null : undefined,
    dob: input.dob !== undefined ? input.dob || null : undefined,
    phone: input.phone !== undefined ? input.phone || null : undefined,
    email: input.email !== undefined ? input.email || null : undefined,
    address: input.address !== undefined ? input.address || null : undefined,
    emergency_contact: input.emergencyContact !== undefined ? input.emergencyContact || null : undefined,
  });

  await recordAuditLogSafe(supabase, {
    organizationId: caller.organization_id,
    userId: callerUserId,
    action: "update",
    entityName: "patients",
    entityId: patientId,
    oldData: patient,
    newData: updated,
  });

  return updated;
}

/**
 * Soft-deletes a patient. Blocked if any appointment, consultation,
 * prescription, or patient record still references the patient.
 */
export async function deletePatient(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  patientId: string
): Promise<Patient> {
  const isAuthorized = await canManagePatients(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  await assertOrganizationCanTransact(supabase, caller.organization_id);

  const patient = await findPatientById(supabase, patientId);
  if (!patient) {
    throw new AppError("Patient not found", ErrorCodes.NOT_FOUND);
  }

  if (patient.organization_id !== caller.organization_id) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  if (await hasClinicalReferences(supabase, patientId)) {
    throw new AppError(
      "Cannot delete a patient with existing appointments, consultations, prescriptions, or records",
      ErrorCodes.PATIENT_HAS_DEPENDENT_RECORDS
    );
  }

  const deleted = await persistPatientUpdate(supabase, patientId, { deleted_at: new Date().toISOString() });

  await recordAuditLogSafe(supabase, {
    organizationId: caller.organization_id,
    userId: callerUserId,
    action: "delete",
    entityName: "patients",
    entityId: patientId,
    oldData: patient,
  });

  return deleted;
}

/**
 * Fetches the details of an active patient.
 * Patients are organization-wide visible; any caller in the same
 * organization (or a platform admin) may view them.
 */
export async function getPatientDetails(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  patientId: string
): Promise<Patient> {
  const isAuthorized = await canViewPatients(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller) {
    throw new Error("Caller not found");
  }

  const patient = await findPatientById(supabase, patientId);
  if (!patient) {
    throw new AppError("Patient not found", ErrorCodes.NOT_FOUND);
  }

  if (caller.organization_id && caller.organization_id !== patient.organization_id) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  return patient;
}

/**
 * Lists organization patients with search, filter, and pagination support.
 */
export async function listOrganizationPatients(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  filters: {
    page: number;
    limit: number;
    search?: string;
    gender?: Database["public"]["Enums"]["patient_gender"];
  }
): Promise<PagedResult<Patient>> {
  const isAuthorized = await canViewPatients(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const patients = await listPatients(supabase, caller.organization_id, filters);
  const total = await countPatients(supabase, caller.organization_id, filters);

  return {
    items: patients,
    total,
    page: filters.page,
    pageSize: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}
