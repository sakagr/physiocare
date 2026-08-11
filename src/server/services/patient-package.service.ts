import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { PatientPackage } from "../repositories/patient-package.repository";
import {
  insertPatientPackage,
  updatePatientPackage as persistPatientPackageUpdate,
  findPatientPackageById,
  listPatientPackagesByPatient,
  countPatientPackagesByPatient,
  listOrganizationPatientPackages as listOrgPatientPackages,
  countOrganizationPatientPackages,
  existsInvoiceForPatientPackage,
} from "../repositories/patient-package.repository";
import {
  listByPatientPackage,
  countByPatientPackage,
  findUsageByAppointmentId,
  consumePackageSession as persistConsumePackageSession,
  reversePackageSessionUsage as persistReversePackageSessionUsage,
  type PackageSessionUsage,
} from "../repositories/package-session-usage.repository";
import { findUserById } from "../repositories/user.repository";
import { findPatientById } from "../repositories/patient.repository";
import { findPackageById } from "../repositories/package.repository";
import {
  canViewPatientPackages,
  canManagePatientPackages,
  canCorrectPackageSessionUsage,
  canOrganizationTransact,
} from "./authorization.service";
import { AppError, ErrorCodes } from "../errors";
import type { PagedResult } from "../validators/shared.validator";
import type { CreatePatientPackageInput, UpdatePatientPackageInput } from "../validators/patient-package.validator";

/**
 * Maps a matchable exception message raised by the consume_package_session
 * database function (a concurrency safety net, see AGENTS.md "Database
 * Functions for Atomic Operations") to the same AppError a well-behaved
 * caller's pre-check would have thrown.
 */
function mapConsumePackageSessionError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("PACKAGE_SESSIONS_EXHAUSTED")) {
    return new AppError("Patient package has no remaining sessions", ErrorCodes.PACKAGE_SESSIONS_EXHAUSTED);
  }
  if (message.includes("PACKAGE_SESSION_ALREADY_RECORDED")) {
    return new AppError("A session has already been recorded for this appointment", ErrorCodes.PACKAGE_SESSION_ALREADY_RECORDED);
  }
  if (message.includes("PATIENT_PACKAGE_NOT_FOUND")) {
    return new AppError("Patient package not found", ErrorCodes.NOT_FOUND);
  }
  return error instanceof Error ? error : new Error(message);
}

/**
 * Assigns a package to a patient, snapshotting the package's name, price,
 * and session count so a later edit to the catalog package never changes a
 * historical purchase record.
 */
export async function createPatientPackage(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  input: CreatePatientPackageInput
): Promise<PatientPackage> {
  const isAuthorized = await canManagePatientPackages(supabase, callerUserId);
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

  const pkg = await findPackageById(supabase, input.packageId);
  if (!pkg || pkg.organization_id !== caller.organization_id) {
    throw new AppError("Package not found", ErrorCodes.NOT_FOUND);
  }

  const purchasedOn = input.purchasedOn ?? new Date().toISOString().slice(0, 10);
  const expiryDate = new Date(purchasedOn);
  expiryDate.setDate(expiryDate.getDate() + pkg.validity_days);

  return insertPatientPackage(supabase, {
    organization_id: caller.organization_id,
    patient_id: patient.id,
    package_id: pkg.id,
    package_name: pkg.package_name,
    package_price: pkg.package_price,
    total_sessions: pkg.total_sessions,
    remaining_sessions: pkg.total_sessions,
    used_sessions: 0,
    purchased_on: purchasedOn,
    expiry_date: expiryDate.toISOString().slice(0, 10),
  });
}

/**
 * Updates a patient package assignment. Only extended validity and a
 * transition to `cancelled` are mutable -- session counts and the snapshot
 * fields are owned by the purchase itself and by Phase 8's consumption logic.
 */
export async function updatePatientPackage(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  patientPackageId: string,
  input: UpdatePatientPackageInput
): Promise<PatientPackage> {
  const isAuthorized = await canManagePatientPackages(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const patientPackage = await findPatientPackageById(supabase, patientPackageId);
  if (!patientPackage) {
    throw new AppError("Patient package not found", ErrorCodes.NOT_FOUND);
  }

  if (patientPackage.organization_id !== caller.organization_id) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  const isCancelling = input.status === "cancelled";
  return persistPatientPackageUpdate(supabase, patientPackageId, {
    extended_validity_to: input.extendedValidityTo !== undefined ? input.extendedValidityTo : undefined,
    cancelled_at: isCancelling ? new Date().toISOString() : undefined,
    cancelled_by: isCancelling ? callerUserId : undefined,
  });
}

/**
 * Soft-deletes a patient package assignment. Blocked if any session has been
 * consumed or any invoice still references it (an administrative correction
 * path only -- purchases with real financial/usage history cannot be undone).
 */
export async function deletePatientPackage(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  patientPackageId: string
): Promise<PatientPackage> {
  const isAuthorized = await canManagePatientPackages(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const patientPackage = await findPatientPackageById(supabase, patientPackageId);
  if (!patientPackage) {
    throw new AppError("Patient package not found", ErrorCodes.NOT_FOUND);
  }

  if (patientPackage.organization_id !== caller.organization_id) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  if (patientPackage.used_sessions > 0 || (await existsInvoiceForPatientPackage(supabase, patientPackageId))) {
    throw new AppError(
      "Cannot delete a patient package that has consumed sessions or has an invoice",
      ErrorCodes.PATIENT_PACKAGE_HAS_REFERENCES
    );
  }

  return persistPatientPackageUpdate(supabase, patientPackageId, { deleted_at: new Date().toISOString() });
}

/**
 * Fetches the details of an active patient package assignment.
 * Patient packages are organization-wide visible.
 */
export async function getPatientPackageDetails(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  patientPackageId: string
): Promise<PatientPackage> {
  const isAuthorized = await canViewPatientPackages(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller) {
    throw new Error("Caller not found");
  }

  const patientPackage = await findPatientPackageById(supabase, patientPackageId);
  if (!patientPackage) {
    throw new AppError("Patient package not found", ErrorCodes.NOT_FOUND);
  }

  if (caller.organization_id && caller.organization_id !== patientPackage.organization_id) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  return patientPackage;
}

/**
 * Lists a patient's package assignments with pagination.
 */
export async function listPatientPackagesForPatient(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  patientId: string,
  filters: {
    page: number;
    limit: number;
    status?: Database["public"]["Enums"]["package_status"];
  }
): Promise<PagedResult<PatientPackage>> {
  const isAuthorized = await canViewPatientPackages(supabase, callerUserId);
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

  const items = await listPatientPackagesByPatient(supabase, patientId, filters);
  const total = await countPatientPackagesByPatient(supabase, patientId, filters);

  return {
    items,
    total,
    page: filters.page,
    pageSize: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}

/**
 * Lists organization patient package assignments with pagination.
 */
export async function listOrganizationPatientPackages(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  filters: {
    page: number;
    limit: number;
    patientId?: string;
    status?: Database["public"]["Enums"]["package_status"];
  }
): Promise<PagedResult<PatientPackage>> {
  const isAuthorized = await canViewPatientPackages(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const items = await listOrgPatientPackages(supabase, caller.organization_id, filters);
  const total = await countOrganizationPatientPackages(supabase, caller.organization_id, filters);

  return {
    items,
    total,
    page: filters.page,
    pageSize: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}

/**
 * Records a package session consumption for an appointment. Called by the
 * appointment-completion workflow (see appointment-workflow.service.ts),
 * never directly by a route -- authorization for the underlying appointment
 * transition has already been checked by that caller.
 *
 * Pre-checks expiry, exhaustion, and double-consumption for a clean error on
 * the common path; the underlying consume_package_session database function
 * re-checks the same invariants under a row lock as a concurrency safety
 * net (see AGENTS.md "Database Functions for Atomic Operations").
 */
export async function consumePackageSession(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  patientPackageId: string,
  appointmentId: string
): Promise<PackageSessionUsage> {
  const isTransactable = await canOrganizationTransact(supabase, organizationId);
  if (!isTransactable) {
    throw new AppError("Organization does not have an active subscription", ErrorCodes.SUBSCRIPTION_REQUIRED);
  }

  const patientPackage = await findPatientPackageById(supabase, patientPackageId);
  if (!patientPackage || patientPackage.organization_id !== organizationId) {
    throw new AppError("Patient package not found", ErrorCodes.NOT_FOUND);
  }

  if (patientPackage.status === "cancelled") {
    throw new AppError("Patient package was cancelled", ErrorCodes.PACKAGE_CANCELLED);
  }

  if (patientPackage.status === "expired") {
    throw new AppError("Patient package has expired", ErrorCodes.PACKAGE_EXPIRED);
  }

  if (patientPackage.remaining_sessions <= 0) {
    throw new AppError("Patient package has no remaining sessions", ErrorCodes.PACKAGE_SESSIONS_EXHAUSTED);
  }

  if (await findUsageByAppointmentId(supabase, appointmentId)) {
    throw new AppError("A session has already been recorded for this appointment", ErrorCodes.PACKAGE_SESSION_ALREADY_RECORDED);
  }

  try {
    return await persistConsumePackageSession(supabase, { organizationId, patientPackageId, appointmentId });
  } catch (error) {
    throw mapConsumePackageSessionError(error);
  }
}

/**
 * Reverses a package session consumption for an appointment, restoring the
 * parent patient package's balance. A no-op if the appointment was never
 * package-linked. Called by the appointment-completion workflow when a
 * completed appointment is transitioned to cancelled.
 */
export async function reversePackageSessionConsumption(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  appointmentId: string
): Promise<void> {
  await persistReversePackageSessionUsage(supabase, { organizationId, appointmentId });
}

/**
 * Administrative correction: soft-deletes a wrongly-recorded session usage
 * (wrong package, duplicate entry, wrong appointment link), restoring the
 * balance. The caller records a fresh, correct consumption via a separate
 * consumePackageSession() call -- this function only undoes the mistake.
 * ORG_OWNER/ORG_ADMIN only, narrower than general patient-package
 * management.
 */
export async function correctPackageSessionUsage(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  appointmentId: string
): Promise<void> {
  const isAuthorized = await canCorrectPackageSessionUsage(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const reversed = await persistReversePackageSessionUsage(supabase, {
    organizationId: caller.organization_id,
    appointmentId,
  });

  if (!reversed) {
    throw new AppError("No session usage record found for this appointment", ErrorCodes.NOT_FOUND);
  }
}

/**
 * Lists session usage history for a patient package.
 */
export async function listPatientPackageUsage(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  patientPackageId: string,
  filters: {
    page: number;
    limit: number;
  }
): Promise<PagedResult<PackageSessionUsage>> {
  await getPatientPackageDetails(supabase, callerUserId, patientPackageId);

  const items = await listByPatientPackage(supabase, patientPackageId, filters);
  const total = await countByPatientPackage(supabase, patientPackageId);

  return {
    items,
    total,
    page: filters.page,
    pageSize: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}
