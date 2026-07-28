import { z } from "zod";
import { invoiceSchema } from "./invoice.contract";
import { appointmentSchema } from "./appointment.contract";

/**
 * Response contracts for the Reports domain (F2, M8/R7) -- the 3 JSON
 * report endpoints. The 3 export routes return binary xlsx/pdf and carry
 * no response schema. Each report aggregates existing domain data
 * (`billing-report.service.ts`, `commission.service.ts`,
 * `physiotherapist-report.service.ts`), reusing `invoiceSchema` and
 * `appointmentSchema` rather than re-describing those entities.
 */

const paymentStatusSchema = z.enum(["completed", "refunded", "cancelled"]);
const paymentModeSchema = z.enum(["cash", "card", "upi", "bank_transfer", "cheque", "wallet", "other"]);
const appointmentStatusSchema = z.enum(["scheduled", "confirmed", "checked_in", "completed", "cancelled", "no_show"]);

// --- Billing report (BillingReport) ---------------------------------------

const billingReportRowSchema = z.object({
  invoice: invoiceSchema,
  /** null means no payment has ever been recorded for this invoice (outstanding). */
  paymentStatus: paymentStatusSchema.nullable(),
});

const billingReportClinicBreakdownSchema = z.object({
  clinicId: z.string(),
  invoiceCount: z.number(),
  totalInvoiced: z.number(),
  totalOutstanding: z.number(),
  paymentTotalsByStatus: z.record(paymentStatusSchema, z.number()),
});

const billingReportSummarySchema = z.object({
  dateFrom: z.string(),
  dateTo: z.string(),
  invoiceCount: z.number(),
  totalInvoiced: z.number(),
  totalOutstanding: z.number(),
  paymentTotalsByStatus: z.record(paymentStatusSchema, z.number()),
  paymentCountByMode: z.partialRecord(paymentModeSchema, z.number()),
  clinicBreakdown: z.array(billingReportClinicBreakdownSchema),
});

export const billingReportSchema = z.object({
  summary: billingReportSummarySchema,
  rows: z.array(billingReportRowSchema),
});

// --- Commission report (CommissionReport) ----------------------------------

const commissionCalculationSchema = z.object({
  physiotherapistId: z.string(),
  dateFrom: z.string(),
  dateTo: z.string(),
  completedAppointmentCount: z.number(),
  totalCommission: z.number(),
});

const commissionReportSummarySchema = z.object({
  dateFrom: z.string(),
  dateTo: z.string(),
  totalCompletedAppointments: z.number(),
  totalCommission: z.number(),
  physiotherapistBreakdown: z.array(commissionCalculationSchema),
});

export const commissionReportSchema = z.object({
  summary: commissionReportSummarySchema,
});

// --- Physiotherapist report (PhysiotherapistReport) -------------------------

const physiotherapistReportRowSchema = z.object({
  appointment: appointmentSchema,
  hasConsultation: z.boolean(),
  /** invoices.total_amount attributed via this appointment's appointment_id, 0 if none. */
  attributedRevenue: z.number(),
});

const physiotherapistTotalsShape = {
  appointmentCount: z.number(),
  appointmentCountsByStatus: z.partialRecord(appointmentStatusSchema, z.number()),
  consultationsCompleted: z.number(),
  attributedRevenue: z.number(),
};

const physiotherapistBreakdownSchema = z.object({
  physiotherapistId: z.string(),
  ...physiotherapistTotalsShape,
});

const physiotherapistReportSummarySchema = z.object({
  dateFrom: z.string(),
  dateTo: z.string(),
  ...physiotherapistTotalsShape,
  physiotherapistBreakdown: z.array(physiotherapistBreakdownSchema),
});

export const physiotherapistReportSchema = z.object({
  summary: physiotherapistReportSummarySchema,
  rows: z.array(physiotherapistReportRowSchema),
});
