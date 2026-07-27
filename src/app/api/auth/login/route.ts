import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRouteClient } from "@/lib/supabase/route";
import { createPublicRouteHandler } from "@/lib/api/route-handler";
import { authenticate } from "@/server/services/session.service";

/**
 * Signs a user in with their username and password, setting the session
 * cookies on the response. Public by necessity: this is the route that
 * creates the session everything else requires.
 *
 * Returns no body — where the user goes next is the landing resolver's
 * decision, which keeps sign-in role-agnostic (UX.md → Landing resolution).
 */
export const POST = createPublicRouteHandler(async (request) => {
  const body = await request.json();

  const adminClient = createAdminClient();
  const authClient = await createRouteClient();

  await authenticate(adminClient, authClient, body);

  return new NextResponse(null, { status: 204 });
});
