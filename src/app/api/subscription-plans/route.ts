import { NextResponse } from "next/server";
import { listSelectableSubscriptionPlans } from "@/server/services/subscription.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const GET = createRouteHandler(async (request, { supabase, user }) => {
  const result = await listSelectableSubscriptionPlans(supabase, user.id);
  return NextResponse.json(result, { status: 200 });
});
