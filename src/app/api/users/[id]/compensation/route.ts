import { NextResponse } from "next/server";
import { setUserCompensation } from "@/server/services/commission.service";
import { validateSetUserCompensationInput } from "@/server/validators/compensation.validator";
import { createRouteHandler } from "@/lib/api/route-handler";

export const POST = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const body = await request.json();
  const validatedInput = validateSetUserCompensationInput(body);
  const result = await setUserCompensation(supabase, user.id, params.id, validatedInput);
  return NextResponse.json(result, { status: 201 });
});
