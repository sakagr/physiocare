import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { activateUser } from "@/server/services/organization.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const POST = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const adminClient = createAdminClient();
  const result = await activateUser(supabase, adminClient, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});
