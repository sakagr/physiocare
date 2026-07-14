import { NextResponse } from "next/server";
import { listUserClinics } from "@/server/services/user-clinic.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const GET = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const result = await listUserClinics(supabase, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});
