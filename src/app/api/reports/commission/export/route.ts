import type { NextRequest } from "next/server";
import { commissionReportQuerySchema, exportFormatSchema } from "@/server/validators/report.validator";
import {
  getCommissionReport,
  COMMISSION_REPORT_EXPORT_COLUMNS,
  buildCommissionReportExportSummary,
} from "@/server/services/commission.service";
import { generateExcelWorkbook, generatePdfDocument } from "@/server/services/export.service";
import { createFileResponse } from "@/lib/api/file-response";
import { createRouteHandler } from "@/lib/api/route-handler";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PDF_CONTENT_TYPE = "application/pdf";

export const GET = createRouteHandler(async (request: NextRequest, { supabase, user }) => {
  const { searchParams } = new URL(request.url);
  const filters = commissionReportQuerySchema.parse({
    dateFrom: searchParams.get("dateFrom") || undefined,
    dateTo: searchParams.get("dateTo") || undefined,
    physiotherapistId: searchParams.get("physiotherapistId") || undefined,
  });
  const format = exportFormatSchema.parse(searchParams.get("format") || undefined);

  // Same call as the JSON route (src/app/api/reports/commission/route.ts)
  // -- the export never filters, aggregates, or calculates independently.
  const report = await getCommissionReport(supabase, user.id, filters);
  const summary = buildCommissionReportExportSummary(report.summary);
  const filename = `commission-report-${filters.dateFrom}-to-${filters.dateTo}.${format}`;

  if (format === "xlsx") {
    const buffer = await generateExcelWorkbook("Commission Report", COMMISSION_REPORT_EXPORT_COLUMNS, report.summary.physiotherapistBreakdown, summary);
    return createFileResponse(buffer, filename, XLSX_CONTENT_TYPE);
  }

  const buffer = await generatePdfDocument("Commission Report", COMMISSION_REPORT_EXPORT_COLUMNS, report.summary.physiotherapistBreakdown, summary);
  return createFileResponse(buffer, filename, PDF_CONTENT_TYPE);
});
