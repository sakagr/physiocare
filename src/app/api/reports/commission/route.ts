import { NextResponse, type NextRequest } from "next/server";
import { commissionReportQuerySchema } from "@/server/validators/report.validator";
import { getCommissionReport } from "@/server/services/commission.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const GET = createRouteHandler(async (request: NextRequest, { supabase, user }) => {
  const { searchParams } = new URL(request.url);
  const filters = commissionReportQuerySchema.parse({
    dateFrom: searchParams.get("dateFrom") || undefined,
    dateTo: searchParams.get("dateTo") || undefined,
    physiotherapistId: searchParams.get("physiotherapistId") || undefined,
  });

  const report = await getCommissionReport(supabase, user.id, filters);
  return NextResponse.json(report, { status: 200 });
});
