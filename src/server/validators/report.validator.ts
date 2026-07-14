import { z } from "zod";

/** Keeps synchronous report/export generation safe (see architecture review, Decision 3). */
export const MAX_REPORT_RANGE_DAYS = 366;

/** Keeps synchronous report/export generation safe for very large organizations. */
export const MAX_REPORT_ROWS = 5000;

function daysBetween(dateFrom: string, dateTo: string): number {
  return Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Validation schema for the billing report query.
 */
export const billingReportQuerySchema = z
  .object({
    dateFrom: z.string().date({ message: "Invalid date." }),
    dateTo: z.string().date({ message: "Invalid date." }),
    clinicId: z.string().uuid({ message: "Invalid clinic ID format." }).optional(),
  })
  .refine((v) => v.dateTo >= v.dateFrom, { message: "dateTo must be on or after dateFrom.", path: ["dateTo"] })
  .refine((v) => daysBetween(v.dateFrom, v.dateTo) <= MAX_REPORT_RANGE_DAYS, {
    message: `Report range cannot exceed ${MAX_REPORT_RANGE_DAYS} days.`,
    path: ["dateTo"],
  });

/**
 * Validation schema for the physiotherapist report query.
 */
export const physiotherapistReportQuerySchema = z
  .object({
    dateFrom: z.string().date({ message: "Invalid date." }),
    dateTo: z.string().date({ message: "Invalid date." }),
    physiotherapistId: z.string().uuid({ message: "Invalid physiotherapist ID format." }).optional(),
    clinicId: z.string().uuid({ message: "Invalid clinic ID format." }).optional(),
  })
  .refine((v) => v.dateTo >= v.dateFrom, { message: "dateTo must be on or after dateFrom.", path: ["dateTo"] })
  .refine((v) => daysBetween(v.dateFrom, v.dateTo) <= MAX_REPORT_RANGE_DAYS, {
    message: `Report range cannot exceed ${MAX_REPORT_RANGE_DAYS} days.`,
    path: ["dateTo"],
  });

/**
 * Validation schema for an export request's output format.
 */
export const exportFormatSchema = z.enum(["xlsx", "pdf"]);

export type BillingReportQuery = z.infer<typeof billingReportQuerySchema>;
export type PhysiotherapistReportQuery = z.infer<typeof physiotherapistReportQuerySchema>;
export type ExportFormat = z.infer<typeof exportFormatSchema>;

export function validateBillingReportQuery(input: unknown): BillingReportQuery {
  return billingReportQuerySchema.parse(input);
}

export function validatePhysiotherapistReportQuery(input: unknown): PhysiotherapistReportQuery {
  return physiotherapistReportQuerySchema.parse(input);
}

export function validateExportFormat(input: unknown): ExportFormat {
  return exportFormatSchema.parse(input);
}
