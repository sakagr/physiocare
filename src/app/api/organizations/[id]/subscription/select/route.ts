import { NextResponse } from "next/server";
import { validateSelectSubscriptionPlanInput } from "@/server/validators/subscription.validator";
import { selectSubscriptionPlan } from "@/server/services/subscription.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const POST = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const body = await request.json();
  const validatedInput = validateSelectSubscriptionPlanInput(body);
  const result = await selectSubscriptionPlan(supabase, user.id, params.id, validatedInput.planName);
  return NextResponse.json(result, { status: 200 });
});
