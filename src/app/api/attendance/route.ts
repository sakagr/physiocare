import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCreateAttendanceInput, attendanceListQuerySchema } from "@/server/validators/attendance.validator";
import { listOrganizationAttendance } from "@/server/services/attendance.service";
import { recordAttendance } from "@/server/services/attendance-workflow.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const POST = createRouteHandler(async (request, { supabase, user }) => {
  const body = await request.json();
  const validatedInput = validateCreateAttendanceInput(body);
  const adminClient = createAdminClient();
  const result = await recordAttendance(supabase, adminClient, user.id, validatedInput);
  return NextResponse.json(result, { status: 201 });
});

export const GET = createRouteHandler(async (request: NextRequest, { supabase, user }) => {
  const { searchParams } = new URL(request.url);
  const filters = attendanceListQuerySchema.parse({
    page: searchParams.get("page") || undefined,
    limit: searchParams.get("limit") || undefined,
    userId: searchParams.get("userId") || undefined,
    clinicId: searchParams.get("clinicId") || undefined,
    dateFrom: searchParams.get("dateFrom") || undefined,
    dateTo: searchParams.get("dateTo") || undefined,
    status: searchParams.get("status") || undefined,
  });

  const result = await listOrganizationAttendance(supabase, user.id, filters);
  return NextResponse.json(result, { status: 200 });
});
