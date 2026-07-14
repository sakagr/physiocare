import { NextResponse } from "next/server";
import { getPaymentDetails } from "@/server/services/payment.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const GET = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const result = await getPaymentDetails(supabase, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});
