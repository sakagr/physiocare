import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route";
import { createRouteHandler } from "@/lib/api/route-handler";
import { changePassword } from "@/server/services/session.service";

/**
 * Changes the caller's password. The current password is required and
 * verified before the new one is set — Supabase does not need it on a live
 * session, but an unattended, unlocked workstation is exactly the case this
 * guards against.
 */
export const POST = createRouteHandler(async (request, { user }) => {
  if (!user.email) {
    throw new Error("Authenticated user has no email address");
  }

  const body = await request.json();
  const authClient = await createRouteClient();

  await changePassword(authClient, user.email, body);

  return new NextResponse(null, { status: 204 });
});
