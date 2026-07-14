import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Appointment } from "../repositories/appointment.repository";
import type { Consultation } from "../repositories/consultation.repository";
import { listAppointmentsForReport } from "../repositories/appointment.repository";
import { listConsultationsByAppointmentIds } from "../repositories/consultation.repository";
import { listInvoicesByAppointmentIds } from "../repositories/invoice.repository";
import { findUserById, findRoleById } from "../repositories/user.repository";
import { findClinicById } from "../repositories/clinic.repository";
import { canViewPhysiotherapistReports } from "./authorization.service";
import { AppError, ErrorCodes } from "../errors";
import { MAX_REPORT_ROWS } from "../validators/report.validator";
import type { PhysiotherapistReportQuery } from "../validators/report.validator";
import type { ExportColumn } from "./export.service";

type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];

export interface PhysiotherapistReportRow {
  appointment: Appointment;
  hasConsultation: boolean;
  /** invoices.total_amount attributed via this appointment's appointment_id, 0 if none. */
  attributedRevenue: number;
}

interface PhysiotherapistReportTotals {
  appointmentCount: number;
  appointmentCountsByStatus: Partial<Record<AppointmentStatus, number>>;
  consultationsCompleted: number;
  attributedRevenue: number;
}

export interface PhysiotherapistBreakdown extends PhysiotherapistReportTotals {
  physiotherapistId: string;
}

export interface PhysiotherapistReportSummary extends PhysiotherapistReportTotals {
  dateFrom: string;
  dateTo: string;
  physiotherapistBreakdown: PhysiotherapistBreakdown[];
}

export interface PhysiotherapistReport {
  summary: PhysiotherapistReportSummary;
  rows: PhysiotherapistReportRow[];
}

/**
 * Aggregates existing Appointment/Consultation/Invoice domain data for a
 * date range, for a single physiotherapist or org-wide. This is the single
 * function backing both the JSON physiotherapist report route and its
 * export route.
 *
 * Revenue attribution rule (exact, no ambiguity): an invoice's total_amount
 * is attributed to physiotherapist P if and only if invoices.appointment_id
 * is non-null and resolves to an appointment where
 * appointments.physiotherapist_id = P. Invoices with no appointment_id are
 * never attributed to anyone.
 */
export async function getPhysiotherapistReport(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  filters: PhysiotherapistReportQuery
): Promise<PhysiotherapistReport> {
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

  // Physiotherapist productivity isn't a front-desk concern the way
  // invoices are -- narrower than Billing Reports, no receptionist access.
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
    const target = await findUserById(supabase, physiotherapistId);
    const targetRole = target ? await findRoleById(supabase, target.role_id) : null;
    if (!target || target.organization_id !== caller.organization_id || targetRole?.name !== "ORG_PHYSIOTHERAPIST") {
      throw new AppError("Physiotherapist not found", ErrorCodes.NOT_FOUND);
    }
  }

  if (filters.clinicId) {
    const clinic = await findClinicById(supabase, filters.clinicId);
    if (!clinic || clinic.organization_id !== caller.organization_id) {
      throw new AppError("Clinic not found", ErrorCodes.NOT_FOUND);
    }
  }

  const appointments = await listAppointmentsForReport(supabase, caller.organization_id, {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    physiotherapistId,
    clinicId: filters.clinicId,
  });

  if (appointments.length > MAX_REPORT_ROWS) {
    throw new AppError(
      `Report would return ${appointments.length} rows, exceeding the ${MAX_REPORT_ROWS} row limit. Narrow the date range or filters.`,
      ErrorCodes.REPORT_ROW_LIMIT_EXCEEDED
    );
  }

  const appointmentIds = appointments.map((appointment) => appointment.id);
  const consultations = await listConsultationsByAppointmentIds(supabase, appointmentIds);
  const invoices = await listInvoicesByAppointmentIds(supabase, appointmentIds);

  const revenueByAppointmentId = new Map<string, number>();
  for (const invoice of invoices) {
    if (!invoice.appointment_id) continue;
    revenueByAppointmentId.set(
      invoice.appointment_id,
      (revenueByAppointmentId.get(invoice.appointment_id) ?? 0) + invoice.total_amount
    );
  }

  const consultedAppointmentIds = new Set(consultations.map((consultation) => consultation.appointment_id));

  const rows: PhysiotherapistReportRow[] = appointments.map((appointment) => ({
    appointment,
    hasConsultation: consultedAppointmentIds.has(appointment.id),
    attributedRevenue: revenueByAppointmentId.get(appointment.id) ?? 0,
  }));

  function summarize(subsetAppointments: Appointment[], subsetConsultations: Consultation[]): PhysiotherapistReportTotals {
    const appointmentCountsByStatus: Partial<Record<AppointmentStatus, number>> = {};
    let attributedRevenue = 0;
    for (const appointment of subsetAppointments) {
      appointmentCountsByStatus[appointment.status] = (appointmentCountsByStatus[appointment.status] ?? 0) + 1;
      attributedRevenue += revenueByAppointmentId.get(appointment.id) ?? 0;
    }
    return {
      appointmentCount: subsetAppointments.length,
      appointmentCountsByStatus,
      consultationsCompleted: subsetConsultations.length,
      attributedRevenue,
    };
  }

  const overall = summarize(appointments, consultations);

  const physiotherapistIdsInScope = Array.from(new Set(appointments.map((appointment) => appointment.physiotherapist_id)));
  const physiotherapistBreakdown: PhysiotherapistBreakdown[] = physiotherapistIdsInScope.map((pId) => ({
    physiotherapistId: pId,
    ...summarize(
      appointments.filter((appointment) => appointment.physiotherapist_id === pId),
      consultations.filter((consultation) => consultation.physiotherapist_id === pId)
    ),
  }));

  return {
    summary: {
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      ...overall,
      physiotherapistBreakdown,
    },
    rows,
  };
}

/**
 * The single column mapping used by the physiotherapist report export route
 * (both xlsx and pdf). Exported so the export route and its parity tests
 * use the exact same definition rather than two independent ones.
 */
export const PHYSIOTHERAPIST_REPORT_EXPORT_COLUMNS: ExportColumn<PhysiotherapistReportRow>[] = [
  { header: "Physiotherapist ID", accessor: (row) => row.appointment.physiotherapist_id },
  { header: "Appointment Time", accessor: (row) => row.appointment.appointment_time },
  { header: "Status", accessor: (row) => row.appointment.status },
  { header: "Has Consultation", accessor: (row) => (row.hasConsultation ? "yes" : "no") },
  { header: "Attributed Revenue", accessor: (row) => row.attributedRevenue },
];

/**
 * Reshapes an already-computed PhysiotherapistReportSummary into a flat
 * key/value map for the export's summary sheet/section. Every value is a
 * direct read of a figure the summary already computed -- no new
 * calculation happens here.
 */
export function buildPhysiotherapistReportExportSummary(summary: PhysiotherapistReportSummary): Record<string, string | number> {
  return {
    "Date From": summary.dateFrom,
    "Date To": summary.dateTo,
    "Appointment Count": summary.appointmentCount,
    "Consultations Completed": summary.consultationsCompleted,
    "Attributed Revenue": summary.attributedRevenue,
  };
}
