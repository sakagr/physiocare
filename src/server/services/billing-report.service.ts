import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Invoice } from "../repositories/invoice.repository";
import { listInvoicesForReport } from "../repositories/invoice.repository";
import { listPaymentsForReport, listPaymentsByInvoiceIds } from "../repositories/payment.repository";
import { findUserById, findRoleById } from "../repositories/user.repository";
import { findClinicById } from "../repositories/clinic.repository";
import { canViewBillingReports, getAccessibleClinicIds } from "./authorization.service";
import { AppError, ErrorCodes } from "../errors";
import { MAX_REPORT_ROWS } from "../validators/report.validator";
import type { BillingReportQuery } from "../validators/report.validator";
import type { ExportColumn } from "./export.service";

type PaymentStatus = Database["public"]["Enums"]["payment_transaction_status"];
type PaymentMode = Database["public"]["Enums"]["payment_mode"];

export interface BillingReportRow {
  invoice: Invoice;
  /** null means no payment has ever been recorded for this invoice (outstanding). */
  paymentStatus: PaymentStatus | null;
}

export interface BillingReportClinicBreakdown {
  clinicId: string;
  invoiceCount: number;
  totalInvoiced: number;
  totalOutstanding: number;
  paymentTotalsByStatus: Record<PaymentStatus, number>;
}

export interface BillingReportSummary {
  dateFrom: string;
  dateTo: string;
  invoiceCount: number;
  totalInvoiced: number;
  totalOutstanding: number;
  /** Sums payments.amount grouped by the existing payment_transaction_status enum -- not a report-invented category. */
  paymentTotalsByStatus: Record<PaymentStatus, number>;
  paymentCountByMode: Partial<Record<PaymentMode, number>>;
  clinicBreakdown: BillingReportClinicBreakdown[];
}

export interface BillingReport {
  summary: BillingReportSummary;
  rows: BillingReportRow[];
}

const EMPTY_PAYMENT_TOTALS: Record<PaymentStatus, number> = { completed: 0, refunded: 0, cancelled: 0 };

function emptyReport(dateFrom: string, dateTo: string): BillingReport {
  return {
    summary: {
      dateFrom,
      dateTo,
      invoiceCount: 0,
      totalInvoiced: 0,
      totalOutstanding: 0,
      paymentTotalsByStatus: { ...EMPTY_PAYMENT_TOTALS },
      paymentCountByMode: {},
      clinicBreakdown: [],
    },
    rows: [],
  };
}

/**
 * Aggregates existing Invoice/Payment domain data for a date range. This is
 * the single function backing both the JSON billing report route and its
 * export route -- every figure is derived from definitions the domain
 * already owns (invoice totals, the payment_transaction_status enum, and
 * "does this invoice have a payment row", the same check invoice.service.ts
 * already relies on to block edits). The report introduces no new financial
 * concept and no export-specific data path.
 */
export async function getBillingReport(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  filters: BillingReportQuery
): Promise<BillingReport> {
  const isAuthorized = await canViewBillingReports(supabase, callerUserId);
  if (!isAuthorized) {
    throw new AppError("Forbidden: Insufficient privileges", ErrorCodes.FORBIDDEN);
  }

  const caller = await findUserById(supabase, callerUserId);
  if (!caller || !caller.organization_id) {
    throw new Error("Caller must belong to a valid organization");
  }

  const roleRecord = await findRoleById(supabase, caller.role_id);
  const roleName = roleRecord?.name;

  // Billing reports are a management/front-desk surface, matching how
  // listOrganizationInvoices already treats physiotherapists (empty result,
  // not FORBIDDEN -- they access their own invoices individually instead).
  if (roleName === "ORG_PHYSIOTHERAPIST") {
    return emptyReport(filters.dateFrom, filters.dateTo);
  }

  if (filters.clinicId) {
    const clinic = await findClinicById(supabase, filters.clinicId);
    if (!clinic || clinic.organization_id !== caller.organization_id) {
      throw new AppError("Clinic not found", ErrorCodes.NOT_FOUND);
    }
  }

  let clinicId = filters.clinicId;
  let clinicIds: string[] | undefined;

  if (roleName === "ORG_RECEPTIONIST") {
    const accessibleClinicIds = await getAccessibleClinicIds(supabase, callerUserId);
    if (filters.clinicId && !accessibleClinicIds.includes(filters.clinicId)) {
      return emptyReport(filters.dateFrom, filters.dateTo);
    }
    if (accessibleClinicIds.length === 0) {
      return emptyReport(filters.dateFrom, filters.dateTo);
    }
    if (!filters.clinicId) {
      clinicIds = accessibleClinicIds;
      clinicId = undefined;
    }
  }

  const invoices = await listInvoicesForReport(supabase, caller.organization_id, {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    clinicId,
    clinicIds,
  });

  if (invoices.length > MAX_REPORT_ROWS) {
    throw new AppError(
      `Report would return ${invoices.length} rows, exceeding the ${MAX_REPORT_ROWS} row limit. Narrow the date range or clinic filter.`,
      ErrorCodes.REPORT_ROW_LIMIT_EXCEEDED
    );
  }

  const payments = await listPaymentsForReport(supabase, caller.organization_id, {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    clinicId,
    clinicIds,
  });

  // Unrestricted by date -- reproduces existsPaymentForInvoice's "has any
  // active payment" semantics for this specific set of invoices, so an
  // invoice paid outside this window is never miscounted as outstanding.
  const paymentsForInvoices = await listPaymentsByInvoiceIds(supabase, invoices.map((invoice) => invoice.id));
  const paymentStatusByInvoiceId = new Map<string, PaymentStatus>();
  for (const payment of paymentsForInvoices) {
    paymentStatusByInvoiceId.set(payment.invoice_id, payment.payment_status);
  }

  const rows: BillingReportRow[] = invoices.map((invoice) => ({
    invoice,
    paymentStatus: paymentStatusByInvoiceId.get(invoice.id) ?? null,
  }));

  function summarize(subset: Invoice[], subsetPayments: (typeof payments)): {
    invoiceCount: number;
    totalInvoiced: number;
    totalOutstanding: number;
    paymentTotalsByStatus: Record<PaymentStatus, number>;
  } {
    const paymentTotalsByStatus: Record<PaymentStatus, number> = { ...EMPTY_PAYMENT_TOTALS };
    for (const payment of subsetPayments) {
      paymentTotalsByStatus[payment.payment_status] += payment.amount;
    }
    return {
      invoiceCount: subset.length,
      totalInvoiced: subset.reduce((sum, invoice) => sum + invoice.total_amount, 0),
      totalOutstanding: subset
        .filter((invoice) => !paymentStatusByInvoiceId.has(invoice.id))
        .reduce((sum, invoice) => sum + invoice.total_amount, 0),
      paymentTotalsByStatus,
    };
  }

  const overall = summarize(invoices, payments);

  const paymentCountByMode: Partial<Record<PaymentMode, number>> = {};
  for (const payment of payments) {
    paymentCountByMode[payment.payment_mode] = (paymentCountByMode[payment.payment_mode] ?? 0) + 1;
  }

  const clinicIdsInScope = Array.from(new Set(invoices.map((invoice) => invoice.clinic_id)));
  const clinicBreakdown: BillingReportClinicBreakdown[] = clinicIdsInScope.map((cId) => {
    const clinicInvoices = invoices.filter((invoice) => invoice.clinic_id === cId);
    const clinicPayments = payments.filter((payment) => payment.invoices.clinic_id === cId);
    return { clinicId: cId, ...summarize(clinicInvoices, clinicPayments) };
  });

  return {
    summary: {
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      ...overall,
      paymentCountByMode,
      clinicBreakdown,
    },
    rows,
  };
}

/**
 * The single column mapping used by the billing report export route (both
 * xlsx and pdf). Exported so the export route and its parity tests use the
 * exact same definition rather than two independent ones.
 */
export const BILLING_REPORT_EXPORT_COLUMNS: ExportColumn<BillingReportRow>[] = [
  { header: "Invoice Number", accessor: (row) => row.invoice.invoice_number },
  { header: "Invoice Date", accessor: (row) => row.invoice.invoice_date },
  { header: "Clinic ID", accessor: (row) => row.invoice.clinic_id },
  { header: "Total Amount", accessor: (row) => row.invoice.total_amount },
  { header: "Payment Status", accessor: (row) => row.paymentStatus ?? "outstanding" },
];

/**
 * Reshapes an already-computed BillingReportSummary into a flat key/value
 * map for the export's summary sheet/section. Every value is a direct read
 * of a figure the summary already computed -- no new calculation happens
 * here.
 */
export function buildBillingReportExportSummary(summary: BillingReportSummary): Record<string, string | number> {
  return {
    "Date From": summary.dateFrom,
    "Date To": summary.dateTo,
    "Invoice Count": summary.invoiceCount,
    "Total Invoiced": summary.totalInvoiced,
    "Total Outstanding": summary.totalOutstanding,
    "Total Collected": summary.paymentTotalsByStatus.completed,
    "Total Refunded": summary.paymentTotalsByStatus.refunded,
    "Total Cancelled": summary.paymentTotalsByStatus.cancelled,
  };
}
