import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Attendance } from "../repositories/attendance.repository";
import {
  insertAttendance,
  updateAttendance as persistAttendanceUpdate,
  findAttendanceById,
  listAttendance,
  countAttendance,
} from "../repositories/attendance.repository";
import { findUserById, findRoleById } from "../repositories/user.repository";
import { findClinicById } from "../repositories/clinic.repository";
import { findAssignmentsByUser } from "../repositories/user-clinic.repository";
import {
  canViewAttendance,
  canManageAttendance,
  canRecordOwnAttendance,
  getAccessibleClinicIds,
  assertOrganizationCanTransact,
} from "./authorization.service";
import { recordAuditLogSafe } from "./audit-log.service";
import { AppError, ErrorCodes } from "../errors";
import type { PagedResult } from "../validators/shared.validator";
import type { CreateAttendanceInput, UpdateAttendanceInput } from "../validators/attendance.validator";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "23505";
}

const CHECK_IN_REQUIRED_STATUSES: Database["public"]["Enums"]["attendance_status"][] = ["present", "half_day"];

/**
 * Records a check-in. `userId` defaults to the caller (self-check-in);
 * ORG_OWNER/ORG_ADMIN/ORG_RECEPTIONIST may record for someone else.
 * present/half_day stamp check_in_time; absent/leave leave it null (D11).
 */
export async function recordCheckIn(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  input: CreateAttendanceInput
): Promise<Attendance> {
  const targetUserId = input.userId ?? callerUserId;

  const isAuthorized = targetUserId === callerUserId
    ? await canRecordOwnAttendance(supabase, callerUserId)
    : await canManageAttendance(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  await assertOrganizationCanTransact(supabase, caller.organization_id);

  const targetUser = await findUserById(supabase, targetUserId);
  if (!targetUser || targetUser.organization_id !== caller.organization_id) {
    throw new AppError("User not found", ErrorCodes.NOT_FOUND);
  }

  const clinic = await findClinicById(supabase, input.clinicId);
  if (!clinic || clinic.organization_id !== caller.organization_id) {
    throw new AppError("Clinic not found", ErrorCodes.NOT_FOUND);
  }

  if (targetUserId !== callerUserId) {
    const callerRole = await findRoleById(supabase, caller.role_id);
    const callerIsManager = callerRole?.name === "ORG_OWNER" || callerRole?.name === "ORG_ADMIN";
    if (!callerIsManager) {
      const accessibleClinicIds = await getAccessibleClinicIds(supabase, callerUserId);
      if (!accessibleClinicIds.includes(input.clinicId)) {
        throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
      }
    }
  }

  const targetRole = await findRoleById(supabase, targetUser.role_id);
  const targetIsManager = targetRole?.name === "ORG_OWNER" || targetRole?.name === "ORG_ADMIN";
  if (!targetIsManager) {
    const assignments = await findAssignmentsByUser(supabase, caller.organization_id, targetUserId);
    if (!assignments.some((a) => a.clinic_id === input.clinicId)) {
      throw new AppError("User is not assigned to this clinic", ErrorCodes.FORBIDDEN);
    }
  }

  const attendanceDate = input.attendanceDate ?? new Date().toISOString().slice(0, 10);
  const checkInTime = CHECK_IN_REQUIRED_STATUSES.includes(input.status) ? new Date().toISOString() : null;

  try {
    return await insertAttendance(supabase, {
      organization_id: caller.organization_id,
      user_id: targetUserId,
      clinic_id: input.clinicId,
      attendance_date: attendanceDate,
      check_in_time: checkInTime,
      status: input.status,
      notes: input.notes || null,
      unavailable_from: input.status === "half_day" ? input.unavailableFrom : null,
      unavailable_to: input.status === "half_day" ? input.unavailableTo : null,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("Attendance has already been recorded for this user on this date", ErrorCodes.ATTENDANCE_ALREADY_RECORDED);
    }
    throw error;
  }
}

/**
 * Records a check-out against an existing attendance record. Rejects
 * checking out a record with no check-in (absent/leave records).
 */
export async function recordCheckOut(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  attendanceId: string
): Promise<Attendance> {
  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const attendance = await findAttendanceById(supabase, attendanceId);
  if (!attendance) {
    throw new AppError("Attendance record not found", ErrorCodes.NOT_FOUND);
  }

  if (attendance.organization_id !== caller.organization_id) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  const isOwnRecord = attendance.user_id === callerUserId;
  if (!isOwnRecord && !(await canManageAttendance(supabase, callerUserId))) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  // Placed after the authorization check rather than after the caller lookup:
  // this function's authorization depends on the record it just resolved, and
  // a caller with no right to the record must not learn its organization's
  // subscription state. Consequence: here a NOT_FOUND or scoping FORBIDDEN
  // wins over SUBSCRIPTION_REQUIRED, unlike the caller-anchored gates.
  await assertOrganizationCanTransact(supabase, caller.organization_id);

  if (!attendance.check_in_time) {
    throw new AppError("Cannot check out a record with no check-in", ErrorCodes.ATTENDANCE_CHECK_IN_REQUIRED);
  }

  const updated = await persistAttendanceUpdate(supabase, attendanceId, {
    check_out_time: new Date().toISOString(),
  });

  // Recording and correcting attendance are audited by
  // attendance-workflow.service.ts, the sole public entry point for both. A
  // check-out never changes `status`, so it can never affect availability and
  // stays outside that workflow -- which left it the one attendance path with
  // no audit entry until F6 (D6).
  await recordAuditLogSafe(supabase, {
    organizationId: attendance.organization_id,
    userId: callerUserId,
    action: "check_out",
    entityName: "user_attendance",
    entityId: attendance.id,
    oldData: attendance,
    newData: updated,
  });

  return updated;
}

/**
 * Applies an administrative correction to an attendance record's
 * status/notes/window. Called only from attendance-workflow.service.ts's
 * `updateAttendance`, which is the sole public entry point for an attendance
 * update -- see AGENTS.md -> Service boundaries (D-L).
 */
export async function updateAttendanceRecord(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  attendanceId: string,
  input: UpdateAttendanceInput
): Promise<Attendance> {
  const isAuthorized = await canManageAttendance(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  await assertOrganizationCanTransact(supabase, caller.organization_id);

  const attendance = await findAttendanceById(supabase, attendanceId);
  if (!attendance) {
    throw new AppError("Attendance record not found", ErrorCodes.NOT_FOUND);
  }

  if (attendance.organization_id !== caller.organization_id) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  const nextStatus = input.status ?? attendance.status;
  const checkInTime = CHECK_IN_REQUIRED_STATUSES.includes(nextStatus) ? attendance.check_in_time : null;
  // Nulled whenever the corrected status is not half_day, mirroring the
  // check_in_time clearing above -- a correction away from half_day cannot
  // leave an orphaned window the CHECK constraint would reject.
  const nextUnavailableFrom = nextStatus === "half_day" ? (input.unavailableFrom ?? attendance.unavailable_from) : null;
  const nextUnavailableTo = nextStatus === "half_day" ? (input.unavailableTo ?? attendance.unavailable_to) : null;

  return persistAttendanceUpdate(supabase, attendanceId, {
    status: input.status,
    notes: input.notes !== undefined ? input.notes || null : undefined,
    check_in_time: checkInTime,
    unavailable_from: nextUnavailableFrom,
    unavailable_to: nextUnavailableTo,
  });
}

/**
 * Fetches the details of an active attendance record.
 */
export async function getAttendanceDetails(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  attendanceId: string
): Promise<Attendance> {
  const isAuthorized = await canViewAttendance(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller) {
    throw new Error("Caller not found");
  }

  const attendance = await findAttendanceById(supabase, attendanceId);
  if (!attendance) {
    throw new AppError("Attendance record not found", ErrorCodes.NOT_FOUND);
  }

  if (caller.organization_id && caller.organization_id !== attendance.organization_id) {
    throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
  }

  const roleRecord = await findRoleById(supabase, caller.role_id);
  const roleName = roleRecord?.name;
  const isManager = roleName === "ORG_OWNER" || roleName === "ORG_ADMIN" || roleName === "SUPER_ADMIN";

  if (!isManager && attendance.user_id !== callerUserId) {
    if (roleName === "ORG_RECEPTIONIST") {
      const accessibleClinicIds = await getAccessibleClinicIds(supabase, callerUserId);
      if (!accessibleClinicIds.includes(attendance.clinic_id)) {
        throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
      }
    } else {
      throw new AppError("Forbidden: Scoping violation", ErrorCodes.FORBIDDEN);
    }
  }

  return attendance;
}

/**
 * Lists organization attendance records with pagination support.
 * - ORG_OWNER/ORG_ADMIN: org-wide.
 * - ORG_RECEPTIONIST: accessible clinics only.
 * - Everyone else: their own records only.
 */
export async function listOrganizationAttendance(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  filters: {
    page: number;
    limit: number;
    userId?: string;
    clinicId?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: Database["public"]["Enums"]["attendance_status"];
  }
): Promise<PagedResult<Attendance>> {
  const isAuthorized = await canViewAttendance(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const roleRecord = await findRoleById(supabase, caller.role_id);
  const roleName = roleRecord?.name;
  const isManager = roleName === "ORG_OWNER" || roleName === "ORG_ADMIN" || roleName === "SUPER_ADMIN";

  let effectiveFilters: typeof filters & { clinicIds?: string[] } = filters;
  if (!isManager) {
    if (roleName === "ORG_RECEPTIONIST") {
      const accessibleClinicIds = await getAccessibleClinicIds(supabase, callerUserId);
      if (filters.clinicId && !accessibleClinicIds.includes(filters.clinicId)) {
        return { items: [], total: 0, page: filters.page, pageSize: filters.limit, totalPages: 0 };
      }
      effectiveFilters = filters.clinicId ? filters : { ...filters, clinicIds: accessibleClinicIds };
    } else {
      effectiveFilters = { ...filters, userId: callerUserId };
    }
  }

  const items = await listAttendance(supabase, caller.organization_id, effectiveFilters);
  const total = await countAttendance(supabase, caller.organization_id, effectiveFilters);

  return {
    items,
    total,
    page: filters.page,
    pageSize: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}
