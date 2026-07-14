import { NextResponse, type NextRequest } from "next/server";
import { physiotherapistReportQuerySchema } from "@/server/validators/report.validator";
import { getPhysiotherapistReport } from "@/server/services/physiotherapist-report.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const GET = createRouteHandler(async (request: NextRequest, { supabase, user }) => {
  const { searchParams } = new URL(request.url);
  const filters = physiotherapistReportQuerySchema.parse({
    dateFrom: searchParams.get("dateFrom") || undefined,
    dateTo: searchParams.get("dateTo") || undefined,
    physiotherapistId: searchParams.get("physiotherapistId") || undefined,
    clinicId: searchParams.get("clinicId") || undefined,
  });

  const report = await getPhysiotherapistReport(supabase, user.id, filters);
  return NextResponse.json(report, { status: 200 });
});
