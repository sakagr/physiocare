import { NextResponse } from "next/server";
import { getClinicDetails } from "@/server/services/clinic.service";
import { updateClinic, deleteClinic } from "@/server/services/organization.service";
import { validateUpdateClinicInput } from "@/server/validators/clinic.validator";
import { createRouteHandler } from "@/lib/api/route-handler";

export const GET = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const result = await getClinicDetails(supabase, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});

export const PATCH = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const body = await request.json();
  const validatedInput = validateUpdateClinicInput(body);
  const result = await updateClinic(supabase, user.id, params.id, validatedInput);
  return NextResponse.json(result, { status: 200 });
});

export const DELETE = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const result = await deleteClinic(supabase, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});
