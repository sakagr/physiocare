import { NextResponse } from "next/server";
import { correctPackageSessionUsage } from "@/server/services/patient-package.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const DELETE = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  await correctPackageSessionUsage(supabase, user.id, params.id);
  return new NextResponse(null, { status: 204 });
});
