import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { UserClinic } from "../repositories/user-clinic.repository";
import {
  upsertAssignment,
  deleteAssignment,
  listUsersByClinic,
  listClinicsByUser,
} from "../repositories/user-clinic.repository";
import { findUserById } from "../repositories/user.repository";
import { findClinicById } from "../repositories/clinic.repository";
import { canViewUserClinicAssignments } from "./authorization.service";
import { AppError, ErrorCodes } from "../errors";
import type { User, Role } from "../repositories/user.repository";
import type { Clinic } from "../repositories/clinic.repository";

/**
 * Internally performs data-access upsert for assignments.
 */
export async function upsertAssignmentInternal(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  userId: string,
  clinicId: string
): Promise<UserClinic> {
  return upsertAssignment(supabase, organizationId, userId, clinicId);
}

/**
 * Internally performs data-access delete for assignments.
 */
export async function deleteAssignmentInternal(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  userId: string,
  clinicId: string
): Promise<UserClinic> {
  return deleteAssignment(supabase, organizationId, userId, clinicId);
}

/**
 * Lists active users assigned to a specific clinic.
 * Asserts same-organization scoping check.
 */
export async function listClinicUsers(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  clinicId: string
): Promise<(User & { role: Role })[]> {
  const isAuthorized = await canViewUserClinicAssignments(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const clinic = await findClinicById(supabase, clinicId);
  if (!clinic) {
    throw new AppError("Clinic not found", ErrorCodes.NOT_FOUND);
  }

  if (clinic.organization_id !== caller.organization_id) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  return listUsersByClinic(supabase, caller.organization_id, clinicId);
}

/**
 * Lists active clinics assigned to a specific user.
 * Asserts same-organization scoping check.
 */
export async function listUserClinics(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  targetUserId: string
): Promise<Clinic[]> {
  const isAuthorized = await canViewUserClinicAssignments(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const targetUser = await findUserById(supabase, targetUserId);
  if (!targetUser) {
    throw new AppError("User not found", ErrorCodes.NOT_FOUND);
  }

  if (targetUser.organization_id !== caller.organization_id) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  return listClinicsByUser(supabase, caller.organization_id, targetUserId);
}
