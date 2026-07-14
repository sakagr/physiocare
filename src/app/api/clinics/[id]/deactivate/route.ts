import { NextResponse } from "next/server";
import { deactivateClinic } from "@/server/services/organization.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const POST = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const result = await deactivateClinic(supabase, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});
