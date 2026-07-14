import { NextResponse } from "next/server";
import { validateUpdatePatientInput } from "@/server/validators/patient.validator";
import { getPatientDetails, updatePatient, deletePatient } from "@/server/services/patient.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const GET = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const result = await getPatientDetails(supabase, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});

export const PATCH = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const body = await request.json();
  const validatedInput = validateUpdatePatientInput(body);
  const result = await updatePatient(supabase, user.id, params.id, validatedInput);
  return NextResponse.json(result, { status: 200 });
});

export const DELETE = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const result = await deletePatient(supabase, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});
