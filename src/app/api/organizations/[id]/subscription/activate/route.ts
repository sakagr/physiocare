import { NextResponse } from "next/server";
import { validateActivateSubscriptionInput } from "@/server/validators/subscription.validator";
import { activateOrganizationSubscription } from "@/server/services/subscription.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const POST = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const body = await request.json();
  const validatedInput = validateActivateSubscriptionInput(body);
  const result = await activateOrganizationSubscription(supabase, user.id, params.id, validatedInput.cycle);
  return NextResponse.json(result, { status: 200 });
});
