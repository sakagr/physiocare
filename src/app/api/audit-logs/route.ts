import { NextResponse, type NextRequest } from "next/server";
import { auditLogListQuerySchema } from "@/server/validators/audit-log.validator";
import { listOrganizationAuditLogs } from "@/server/services/audit-log.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const GET = createRouteHandler(async (request: NextRequest, { supabase, user }) => {
  const { searchParams } = new URL(request.url);
  const filters = auditLogListQuerySchema.parse({
    page: searchParams.get("page") || undefined,
    limit: searchParams.get("limit") || undefined,
    entityName: searchParams.get("entityName") || undefined,
    userId: searchParams.get("userId") || undefined,
    dateFrom: searchParams.get("dateFrom") || undefined,
    dateTo: searchParams.get("dateTo") || undefined,
  });

  const result = await listOrganizationAuditLogs(supabase, user.id, filters);
  return NextResponse.json(result, { status: 200 });
});
