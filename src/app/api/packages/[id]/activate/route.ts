import { NextResponse } from "next/server";
import { activatePackage } from "@/server/services/package.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const POST = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const result = await activatePackage(supabase, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});
