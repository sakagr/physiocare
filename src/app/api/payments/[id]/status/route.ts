import { NextResponse } from "next/server";
import { validateUpdatePaymentStatusInput } from "@/server/validators/payment.validator";
import { updatePaymentStatus } from "@/server/services/payment.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const PATCH = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const body = await request.json();
  const validatedInput = validateUpdatePaymentStatusInput(body);
  const result = await updatePaymentStatus(supabase, user.id, params.id, validatedInput.status);
  return NextResponse.json(result, { status: 200 });
});
