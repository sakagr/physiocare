import type { NextRequest } from "next/server";
import { physiotherapistReportQuerySchema, exportFormatSchema } from "@/server/validators/report.validator";
import {
  getPhysiotherapistReport,
  PHYSIOTHERAPIST_REPORT_EXPORT_COLUMNS,
  buildPhysiotherapistReportExportSummary,
} from "@/server/services/physiotherapist-report.service";
import { generateExcelWorkbook, generatePdfDocument } from "@/server/services/export.service";
import { createFileResponse } from "@/lib/api/file-response";
import { createRouteHandler } from "@/lib/api/route-handler";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PDF_CONTENT_TYPE = "application/pdf";

export const GET = createRouteHandler(async (request: NextRequest, { supabase, user }) => {
  const { searchParams } = new URL(request.url);
  const filters = physiotherapistReportQuerySchema.parse({
    dateFrom: searchParams.get("dateFrom") || undefined,
    dateTo: searchParams.get("dateTo") || undefined,
    physiotherapistId: searchParams.get("physiotherapistId") || undefined,
    clinicId: searchParams.get("clinicId") || undefined,
  });
  const format = exportFormatSchema.parse(searchParams.get("format") || undefined);

  // Same call as the JSON route (src/app/api/reports/physiotherapists/route.ts)
  // -- the export never filters, aggregates, or calculates independently.
  const report = await getPhysiotherapistReport(supabase, user.id, filters);
  const summary = buildPhysiotherapistReportExportSummary(report.summary);
  const filename = `physiotherapist-report-${filters.dateFrom}-to-${filters.dateTo}.${format}`;

  if (format === "xlsx") {
    const buffer = await generateExcelWorkbook("Physiotherapist Report", PHYSIOTHERAPIST_REPORT_EXPORT_COLUMNS, report.rows, summary);
    return createFileResponse(buffer, filename, XLSX_CONTENT_TYPE);
  }

  const buffer = await generatePdfDocument("Physiotherapist Report", PHYSIOTHERAPIST_REPORT_EXPORT_COLUMNS, report.rows, summary);
  return createFileResponse(buffer, filename, PDF_CONTENT_TYPE);
});
