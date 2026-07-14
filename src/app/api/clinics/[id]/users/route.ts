import { NextResponse } from "next/server";
import { listClinicUsers } from "@/server/services/user-clinic.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const GET = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const result = await listClinicUsers(supabase, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});
