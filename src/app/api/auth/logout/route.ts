import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route";
import { createPublicRouteHandler } from "@/lib/api/route-handler";
import { endSession } from "@/server/services/session.service";

/**
 * Ends the caller's session and clears its cookies. Deliberately public and
 * idempotent: signing out is always safe, including when the session has
 * already expired.
 */
export const POST = createPublicRouteHandler(async () => {
  const authClient = await createRouteClient();

  await endSession(authClient);

  return new NextResponse(null, { status: 204 });
});
