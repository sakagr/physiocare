import { NextResponse, type NextRequest } from "next/server";
import { billingReportQuerySchema } from "@/server/validators/report.validator";
import { getBillingReport } from "@/server/services/billing-report.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const GET = createRouteHandler(async (request: NextRequest, { supabase, user }) => {
  const { searchParams } = new URL(request.url);
  const filters = billingReportQuerySchema.parse({
    dateFrom: searchParams.get("dateFrom") || undefined,
    dateTo: searchParams.get("dateTo") || undefined,
    clinicId: searchParams.get("clinicId") || undefined,
  });

  const report = await getBillingReport(supabase, user.id, filters);
  return NextResponse.json(report, { status: 200 });
});
