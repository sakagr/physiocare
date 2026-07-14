import { NextResponse } from "next/server";
import { deactivatePackage } from "@/server/services/package.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const POST = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const result = await deactivatePackage(supabase, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});
