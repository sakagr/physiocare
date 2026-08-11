import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { UserCompensation } from "../repositories/user-compensation.repository";
import { insertUserCompensation, listCompensationsByUser } from "../repositories/user-compensation.repository";
import { listAppointmentsForReport } from "../repositories/appointment.repository";
import { listUsageByAppointmentIds } from "../repositories/package-session-usage.repository";
import { listPatientPackagesByIds } from "../repositories/patient-package.repository";
import { listInvoicesByAppointmentIds } from "../repositories/invoice.repository";
import { findUserById, findRoleById } from "../repositories/user.repository";
import {
  canManageCompensation,
  canViewCompensation,
  canViewPhysiotherapistReports,
  assertOrganizationCanTransact,
} from "./authorization.service";
import { AppError, ErrorCodes } from "../errors";
import type { SetUserCompensationInput } from "../validators/compensation.validator";
import { MAX_REPORT_ROWS } from "../validators/report.validator";
import type { CommissionReportQuery } from "../validators/report.validator";
import type { ExportColumn } from "./export.service";

export interface CommissionCalculation {
  physiotherapistId: string;
  dateFrom: string;
  dateTo: string;
  completedAppointmentCount: number;
  totalCommission: number;
}

/**
 * Sets a user's compensation record, effective from a given date (defaults
 * to today). Never overwrites history -- each call inserts a new
 * time-versioned row rather than mutating a prior one, so past commission
 * calculations remain stable even after a rate change.
 */
export async function setUserCompensation(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  targetUserId: string,
  input: SetUserCompensationInput
): Promise<UserCompensation> {
  const isAuthorized = await canManageCompensation(supabase, callerUserId);
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

  return insertUserCompensation(supabase, {
    organization_id: caller.organization_id,
    user_id: targetUserId,
    type: input.type,
    value: input.value,
    effective_from: input.effectiveFrom ?? new Date().toISOString().slice(0, 10),
    created_by: callerUserId,
  });
}

/**
 * Returns a user's full compensation history, newest-first (Owner-only,
 * D2/ADR-0011). Reverses `listCompensationsByUser`'s ascending order rather
 * than adding a new repository query -- that ascending order is load-bearing
 * for `calculateCommission`'s effective-date resolution and must not change.
 */
export async function getUserCompensationHistory(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  targetUserId: string
): Promise<UserCompensation[]> {
  const isAuthorized = await canViewCompensation(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const targetUser = await findUserById(supabase, targetUserId);
  if (!targetUser || targetUser.organization_id !== caller.organization_id) {
    throw new AppError("User not found", ErrorCodes.NOT_FOUND);
  }

  const compensationsAscending = await listCompensationsByUser(supabase, caller.organization_id, targetUserId);
  return [...compensationsAscending].reverse();
}

/**
 * Resolves the compensation record in effect as of a given date from an
 * ascending-by-effective_from list: the latest row whose effective_from is
 * on or before asOfDate, or null if the user had no compensation record
 * that early.
 */
function resolveEffectiveCompensation(
  compensationsAscending: UserCompensation[],
  asOfDate: string
): UserCompensation | null {
  let effective: UserCompensation | null = null;
  for (const compensation of compensationsAscending) {
    if (compensation.effective_from > asOfDate) {
      break;
    }
    effective = compensation;
  }
  return effective;
}

/**
 * Calculates a physiotherapist's commission for completed appointments in a
 * date range. Always anchored to appointments.status = 'completed' --
 * decoupled from invoice generation and payment collection, since
 * commission is earned when treatment is delivered.
 *
 * Per completed appointment, the commissionable amount is:
 *  - package-linked (a package_session_usage row exists for it): the
 *    package's snapshotted price divided evenly across its total sessions.
 *    Any invoice for that specific appointment is ignored -- package
 *    invoicing is per-package, not per-session, so it can't be attributed
 *    to one appointment.
 *  - not package-linked: the appointment's attributed invoice total
 *    (invoices.appointment_id -> total_amount, 0 if no invoice exists yet).
 *
 * The compensation record used is whichever was in effect on that specific
 * appointment's completion date, resolved per appointment so a mid-range
 * rate change is honored correctly rather than applying one blended rate.
 * For type = 'fixed', the commissionable amount is irrelevant -- every
 * completed appointment contributes the flat rate in effect on its date.
 */
export async function calculateCommission(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  physiotherapistId: string,
  dateFrom: string,
  dateTo: string
): Promise<CommissionCalculation> {
  const appointments = await listAppointmentsForReport(supabase, organizationId, {
    dateFrom,
    dateTo,
    physiotherapistId,
  });
  const completedAppointments = appointments.filter((appointment) => appointment.status === "completed");
  const appointmentIds = completedAppointments.map((appointment) => appointment.id);

  const usageRows = await listUsageByAppointmentIds(supabase, appointmentIds);
  const usageByAppointmentId = new Map(usageRows.map((usage) => [usage.appointment_id, usage]));

  const patientPackageIds = Array.from(new Set(usageRows.map((usage) => usage.patient_package_id)));
  const patientPackages = await listPatientPackagesByIds(supabase, patientPackageIds);
  const patientPackageById = new Map(patientPackages.map((patientPackage) => [patientPackage.id, patientPackage]));

  const invoices = await listInvoicesByAppointmentIds(supabase, appointmentIds);
  const invoiceTotalByAppointmentId = new Map<string, number>();
  for (const invoice of invoices) {
    if (!invoice.appointment_id) continue;
    invoiceTotalByAppointmentId.set(
      invoice.appointment_id,
      (invoiceTotalByAppointmentId.get(invoice.appointment_id) ?? 0) + invoice.total_amount
    );
  }

  const compensationsAscending = await listCompensationsByUser(supabase, organizationId, physiotherapistId);

  let totalCommission = 0;
  for (const appointment of completedAppointments) {
    const asOfDate = appointment.appointment_time.slice(0, 10);
    const compensation = resolveEffectiveCompensation(compensationsAscending, asOfDate);
    if (!compensation || compensation.type === "none") {
      continue;
    }

    if (compensation.type === "fixed") {
      totalCommission += compensation.value;
      continue;
    }

    const usage = usageByAppointmentId.get(appointment.id);
    const commissionableAmount = usage
      ? (() => {
          const patientPackage = patientPackageById.get(usage.patient_package_id);
          return patientPackage ? patientPackage.package_price / patientPackage.total_sessions : 0;
        })()
      : invoiceTotalByAppointmentId.get(appointment.id) ?? 0;

    totalCommission += commissionableAmount * (compensation.value / 100);
  }

  return {
    physiotherapistId,
    dateFrom,
    dateTo,
    completedAppointmentCount: completedAppointments.length,
    totalCommission,
  };
}

/**
 * Verifies a physiotherapist ID belongs to the caller's organization and is
 * actually an ORG_PHYSIOTHERAPIST, mirroring the same guard
 * physiotherapist-report.service.ts uses.
 */
export async function assertPhysiotherapistInOrganization(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  physiotherapistId: string
): Promise<void> {
  const target = await findUserById(supabase, physiotherapistId);
  const targetRole = target ? await findRoleById(supabase, target.role_id) : null;
  if (!target || target.organization_id !== organizationId || targetRole?.name !== "ORG_PHYSIOTHERAPIST") {
    throw new AppError("Physiotherapist not found", ErrorCodes.NOT_FOUND);
  }
}

export interface CommissionReportSummary {
  dateFrom: string;
  dateTo: string;
  totalCompletedAppointments: number;
  totalCommission: number;
  physiotherapistBreakdown: CommissionCalculation[];
}

export interface CommissionReport {
  summary: CommissionReportSummary;
}

/**
 * Aggregates calculateCommission() across every physiotherapist with at
 * least one completed appointment in the date range (or a single
 * physiotherapist, if filtered) -- the "Monthly Commission Report". Same
 * authorization boundary as the physiotherapist report: ORG_OWNER/ORG_ADMIN
 * see everyone, ORG_PHYSIOTHERAPIST sees only their own, ORG_RECEPTIONIST
 * is forbidden (commission is financial-per-person data, narrower than
 * billing).
 */
export async function getCommissionReport(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  filters: CommissionReportQuery
): Promise<CommissionReport> {
  const isAuthorized = await canViewPhysiotherapistReports(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const roleRecord = await findRoleById(supabase, caller.role_id);
  const roleName = roleRecord?.name;

  if (roleName === "ORG_RECEPTIONIST") {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  let physiotherapistId = filters.physiotherapistId;

  if (roleName === "ORG_PHYSIOTHERAPIST") {
    if (physiotherapistId && physiotherapistId !== callerUserId) {
      throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
    }
    physiotherapistId = callerUserId;
  }

  if (physiotherapistId) {
    await assertPhysiotherapistInOrganization(supabase, caller.organization_id, physiotherapistId);
  }

  const appointments = await listAppointmentsForReport(supabase, caller.organization_id, {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    physiotherapistId,
  });

  if (appointments.length > MAX_REPORT_ROWS) {
    throw new AppError(
      `Report would return ${appointments.length} rows, exceeding the ${MAX_REPORT_ROWS} row limit. Narrow the date range or filters.`,
      ErrorCodes.REPORT_ROW_LIMIT_EXCEEDED
    );
  }

  const physiotherapistIdsInScope = Array.from(
    new Set(appointments.filter((appointment) => appointment.status === "completed").map((appointment) => appointment.physiotherapist_id))
  );

  const physiotherapistBreakdown = await Promise.all(
    physiotherapistIdsInScope.map((id) => calculateCommission(supabase, caller.organization_id!, id, filters.dateFrom, filters.dateTo))
  );

  const totalCompletedAppointments = physiotherapistBreakdown.reduce((sum, row) => sum + row.completedAppointmentCount, 0);
  const totalCommission = physiotherapistBreakdown.reduce((sum, row) => sum + row.totalCommission, 0);

  return {
    summary: {
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      totalCompletedAppointments,
      totalCommission,
      physiotherapistBreakdown,
    },
  };
}

/**
 * Export column mapping for the commission report -- one row per
 * physiotherapist in scope, used by both the xlsx and pdf export routes.
 */
export const COMMISSION_REPORT_EXPORT_COLUMNS: ExportColumn<CommissionCalculation>[] = [
  { header: "Physiotherapist ID", accessor: (row) => row.physiotherapistId },
  { header: "Completed Appointments", accessor: (row) => row.completedAppointmentCount },
  { header: "Total Commission", accessor: (row) => row.totalCommission },
];

/**
 * Reshapes an already-computed CommissionReportSummary into a flat
 * key/value map for the export's summary sheet/section.
 */
export function buildCommissionReportExportSummary(summary: CommissionReportSummary): Record<string, string | number> {
  return {
    "Date From": summary.dateFrom,
    "Date To": summary.dateTo,
    "Total Completed Appointments": summary.totalCompletedAppointments,
    "Total Commission": summary.totalCommission,
  };
}
