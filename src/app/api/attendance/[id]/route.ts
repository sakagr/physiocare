import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAttendanceDetails } from "@/server/services/attendance.service";
import { updateAttendance } from "@/server/services/attendance-workflow.service";
import { validateUpdateAttendanceInput } from "@/server/validators/attendance.validator";
import { createRouteHandler } from "@/lib/api/route-handler";

export const GET = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const result = await getAttendanceDetails(supabase, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});

export const PATCH = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const body = await request.json();
  const validatedInput = validateUpdateAttendanceInput(body);
  const adminClient = createAdminClient();
  const result = await updateAttendance(supabase, adminClient, user.id, params.id, validatedInput);
  return NextResponse.json(result, { status: 200 });
});
