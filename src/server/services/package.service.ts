import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Package } from "../repositories/package.repository";
import {
  insertPackage,
  updatePackage as persistPackageUpdate,
  findPackageById,
  findPackageByNameInOrg,
  listPackages,
  countPackages,
} from "../repositories/package.repository";
import { findUserById } from "../repositories/user.repository";
import { existsPatientPackagesForPackage } from "../repositories/patient-package.repository";
import { canViewPackages, canManagePackages } from "./authorization.service";
import { recordAuditLog } from "./audit-log.service";
import { AppError, ErrorCodes } from "../errors";
import type { PagedResult } from "../validators/shared.validator";
import type { CreatePackageInput, UpdatePackageInput } from "../validators/package.validator";

/**
 * Creates a new package in the organization's catalog.
 */
export async function createPackage(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  input: CreatePackageInput
): Promise<Package> {
  const isAuthorized = await canManagePackages(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const nameCollision = await findPackageByNameInOrg(supabase, caller.organization_id, input.packageName);
  if (nameCollision) {
    throw new AppError(
      `Package with name "${input.packageName}" already exists in the organization`,
      ErrorCodes.PACKAGE_NAME_ALREADY_EXISTS
    );
  }

  return insertPackage(supabase, {
    organization_id: caller.organization_id,
    package_name: input.packageName,
    total_sessions: input.totalSessions,
    package_price: input.packagePrice,
    validity_days: input.validityDays,
  });
}

/**
 * Updates package details. Scoped strictly to the organization.
 */
export async function updatePackage(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  packageId: string,
  input: UpdatePackageInput
): Promise<Package> {
  const isAuthorized = await canManagePackages(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const pkg = await findPackageById(supabase, packageId);
  if (!pkg) {
    throw new AppError("Package not found", ErrorCodes.NOT_FOUND);
  }

  if (pkg.organization_id !== caller.organization_id) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  if (input.packageName && input.packageName !== pkg.package_name) {
    const nameCollision = await findPackageByNameInOrg(supabase, caller.organization_id, input.packageName);
    if (nameCollision) {
      throw new AppError(
        `Package with name "${input.packageName}" already exists in the organization`,
        ErrorCodes.PACKAGE_NAME_ALREADY_EXISTS
      );
    }
  }

  return persistPackageUpdate(supabase, packageId, {
    package_name: input.packageName,
    total_sessions: input.totalSessions,
    package_price: input.packagePrice,
    validity_days: input.validityDays,
  });
}

/**
 * Toggles a package's status to active (is_active: true).
 */
export async function activatePackage(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  packageId: string
): Promise<Package> {
  const isAuthorized = await canManagePackages(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const pkg = await findPackageById(supabase, packageId);
  if (!pkg) {
    throw new AppError("Package not found", ErrorCodes.NOT_FOUND);
  }

  if (pkg.organization_id !== caller.organization_id) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  return persistPackageUpdate(supabase, packageId, { is_active: true });
}

/**
 * Toggles a package's status to inactive (is_active: false).
 */
export async function deactivatePackage(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  packageId: string
): Promise<Package> {
  const isAuthorized = await canManagePackages(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const pkg = await findPackageById(supabase, packageId);
  if (!pkg) {
    throw new AppError("Package not found", ErrorCodes.NOT_FOUND);
  }

  if (pkg.organization_id !== caller.organization_id) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  return persistPackageUpdate(supabase, packageId, { is_active: false });
}

/**
 * Soft-deletes a package. Blocked if any patient package still references it.
 */
export async function deletePackage(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  packageId: string
): Promise<Package> {
  const isAuthorized = await canManagePackages(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const pkg = await findPackageById(supabase, packageId);
  if (!pkg) {
    throw new AppError("Package not found", ErrorCodes.NOT_FOUND);
  }

  if (pkg.organization_id !== caller.organization_id) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  if (await existsPatientPackagesForPackage(supabase, packageId)) {
    throw new AppError(
      "Cannot delete a package that has been assigned to a patient",
      ErrorCodes.PACKAGE_HAS_ACTIVE_ASSIGNMENTS
    );
  }

  const deleted = await persistPackageUpdate(supabase, packageId, { deleted_at: new Date().toISOString() });

  await recordAuditLog(supabase, {
    organizationId: pkg.organization_id,
    userId: callerUserId,
    action: "delete",
    entityName: "packages",
    entityId: pkg.id,
    oldData: pkg,
  });

  return deleted;
}

/**
 * Fetches the details of an active package.
 * Packages are organization-wide visible; any caller in the same
 * organization (or a platform admin) may view them.
 */
export async function getPackageDetails(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  packageId: string
): Promise<Package> {
  const isAuthorized = await canViewPackages(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller) {
    throw new Error("Caller not found");
  }

  const pkg = await findPackageById(supabase, packageId);
  if (!pkg) {
    throw new AppError("Package not found", ErrorCodes.NOT_FOUND);
  }

  if (caller.organization_id && caller.organization_id !== pkg.organization_id) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  return pkg;
}

/**
 * Lists organization packages with search, filter, and pagination support.
 */
export async function listOrganizationPackages(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  filters: {
    page: number;
    limit: number;
    search?: string;
    isActive?: boolean;
  }
): Promise<PagedResult<Package>> {
  const isAuthorized = await canViewPackages(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const packages = await listPackages(supabase, caller.organization_id, filters);
  const total = await countPackages(supabase, caller.organization_id, filters);

  return {
    items: packages,
    total,
    page: filters.page,
    pageSize: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}
