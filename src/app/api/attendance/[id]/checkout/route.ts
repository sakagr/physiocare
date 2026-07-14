import { NextResponse } from "next/server";
import { recordCheckOut } from "@/server/services/attendance.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const PATCH = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const result = await recordCheckOut(supabase, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});
