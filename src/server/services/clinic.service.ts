import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Clinic, InsertClinic, UpdateClinic } from "../repositories/clinic.repository";
import {
  insertClinic,
  updateClinic,
  findClinicById,
  listClinics,
  countClinics,
} from "../repositories/clinic.repository";
import { findUserById } from "../repositories/user.repository";
import { canViewClinics } from "./authorization.service";
import { AppError, ErrorCodes } from "../errors";
import type { PagedResult } from "../validators/shared.validator";

/**
 * Creates a clinic in the database.
 */
export async function createClinicInternal(
  supabase: SupabaseClient<Database>,
  clinic: InsertClinic
): Promise<Clinic> {
  return insertClinic(supabase, clinic);
}

/**
 * Updates a clinic in the database.
 */
export async function updateClinicInternal(
  supabase: SupabaseClient<Database>,
  clinicId: string,
  clinic: UpdateClinic
): Promise<Clinic> {
  return updateClinic(supabase, clinicId, clinic);
}

/**
 * Fetches the details of an active clinic.
 * Asserts scoping to the caller's organization.
 */
export async function getClinicDetails(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  clinicId: string
): Promise<Clinic> {
  const isAuthorized = await canViewClinics(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller) {
    throw new Error("Caller not found");
  }

  const clinic = await findClinicById(supabase, clinicId);
  if (!clinic) {
    throw new AppError("Clinic not found", ErrorCodes.NOT_FOUND);
  }

  // Enforce organization scope checking (unless platform admin)
  if (caller.organization_id && caller.organization_id !== clinic.organization_id) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  return clinic;
}

/**
 * Lists organization clinics with search, filter, and pagination support.
 */
export async function listOrganizationClinics(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  filters: {
    page: number;
    limit: number;
    search?: string;
    isActive?: boolean;
  }
): Promise<PagedResult<Clinic>> {
  const isAuthorized = await canViewClinics(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const clinics = await listClinics(supabase, caller.organization_id, filters);
  const total = await countClinics(supabase, caller.organization_id, filters);

  return {
    items: clinics,
    total,
    page: filters.page,
    pageSize: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}
