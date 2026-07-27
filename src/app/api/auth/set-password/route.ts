import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route";
import { createRouteHandler } from "@/lib/api/route-handler";
import {
  PASSWORD_SETUP_COOKIE,
  isPasswordSetupFlow,
} from "@/lib/auth/password-setup-ticket";
import { AppError, ErrorCodes } from "@/server/errors";
import { setPassword } from "@/server/services/session.service";

/**
 * Sets a password on a recovery or invitation session — the one path that
 * does not ask for the current password.
 *
 * Two things must hold: a valid session (enforced by the route wrapper) and
 * the password-setup ticket `/auth/callback` issues when it verifies an
 * emailed link (ADR-0007). Without the ticket this route would let anyone at
 * an unlocked workstation take the account over, which is exactly what
 * requiring the current password elsewhere prevents.
 */
export const POST = createRouteHandler(async (request) => {
  const cookieStore = await cookies();
  const ticket = cookieStore.get(PASSWORD_SETUP_COOKIE)?.value;

  if (!isPasswordSetupFlow(ticket)) {
    throw new AppError(
      "This link has expired. Request a new one to set your password.",
      ErrorCodes.PASSWORD_SETUP_SESSION_INVALID
    );
  }

  const body = await request.json();
  const authClient = await createRouteClient();

  await setPassword(authClient, body);

  // Single use: the ticket is spent whether or not the user stays here.
  cookieStore.delete(PASSWORD_SETUP_COOKIE);

  return new NextResponse(null, { status: 204 });
});
