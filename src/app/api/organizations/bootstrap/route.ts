import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canBootstrapOrganization } from "@/server/services/authorization.service";
import { bootstrapOrganization } from "@/server/services/organization.service";
import { createRouteHandler, withCapability } from "@/lib/api/route-handler";

export const POST = createRouteHandler(
  withCapability(canBootstrapOrganization, async (request, { supabase }) => {
    const body = await request.json();
    const adminClient = createAdminClient();
    const result = await bootstrapOrganization(supabase, adminClient, body);
    return NextResponse.json(result, { status: 201 });
  })
);
