import { NextResponse } from "next/server";
import { validateUpdatePrescriptionInput } from "@/server/validators/prescription.validator";
import { getPrescriptionDetails, updatePrescription } from "@/server/services/prescription.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const GET = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const result = await getPrescriptionDetails(supabase, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});

export const PATCH = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const body = await request.json();
  const validatedInput = validateUpdatePrescriptionInput(body);
  const result = await updatePrescription(supabase, user.id, params.id, validatedInput);
  return NextResponse.json(result, { status: 200 });
});
