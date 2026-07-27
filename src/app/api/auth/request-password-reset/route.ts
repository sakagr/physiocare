import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRouteClient } from "@/lib/supabase/route";
import { createPublicRouteHandler } from "@/lib/api/route-handler";
import { requestPasswordReset } from "@/server/services/session.service";

/**
 * Sends a password-recovery link for the account behind a username.
 *
 * Answers 204 whatever it finds — an unknown username, a deactivated account,
 * and a delivered email are indistinguishable — so the endpoint cannot be used
 * to discover who has an account here.
 */
export const POST = createPublicRouteHandler(async (request) => {
  const body = await request.json();

  const adminClient = createAdminClient();
  const authClient = await createRouteClient();

  await requestPasswordReset(adminClient, authClient, body);

  return new NextResponse(null, { status: 204 });
});
