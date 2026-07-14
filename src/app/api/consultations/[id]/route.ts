import { NextResponse } from "next/server";
import { validateUpdateConsultationInput } from "@/server/validators/consultation.validator";
import { getConsultationDetails, updateConsultation } from "@/server/services/consultation.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const GET = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const result = await getConsultationDetails(supabase, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});

export const PATCH = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const body = await request.json();
  const validatedInput = validateUpdateConsultationInput(body);
  const result = await updateConsultation(supabase, user.id, params.id, validatedInput);
  return NextResponse.json(result, { status: 200 });
});
