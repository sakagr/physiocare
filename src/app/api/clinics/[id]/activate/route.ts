import { NextResponse } from "next/server";
import { activateClinic } from "@/server/services/organization.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const POST = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const result = await activateClinic(supabase, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});
