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
import { listByPatientPackage, countByPatientPackage, type PackageSessionUsage } from "../repositories/package-session-usage.repository";
import { findUserById } from "../repositories/user.repository";
import { findPatientById } from "../repositories/patient.repository";
import { findPackageById } from "../repositories/package.repository";
import { canViewPatientPackages, canManagePatientPackages } from "./authorization.service";
import { AppError, ErrorCodes } from "../errors";
import type { PagedResult } from "../validators/shared.validator";
import type { CreatePatientPackageInput, UpdatePatientPackageInput } from "../validators/patient-package.validator";

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
    status: "active",
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

  return persistPatientPackageUpdate(supabase, patientPackageId, {
    extended_validity_to: input.extendedValidityTo !== undefined ? input.extendedValidityTo : undefined,
    status: input.status !== undefined ? input.status : undefined,
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
 * Lists session usage history for a patient package (read-only in this
 * phase -- see Phase 8 for consumption logic).
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
