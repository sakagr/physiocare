import { NextResponse } from "next/server";
import { createRouteHandler } from "@/lib/api/route-handler";
import { getCurrentUser } from "@/server/services/me.service";

/**
 * Returns the authenticated caller's identity, role, group, organization
 * context, and coarse capability map. Authentication is enforced by the
 * route handler wrapper; read-only, so it is called directly (CQRS query).
 */
export const GET = createRouteHandler(async (_request, { supabase, user }) => {
  const currentUser = await getCurrentUser(supabase, user.id);
  return NextResponse.json(currentUser, { status: 200 });
});
