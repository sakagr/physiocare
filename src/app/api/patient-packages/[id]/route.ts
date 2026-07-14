import { NextResponse } from "next/server";
import { getPatientPackageDetails, updatePatientPackage, deletePatientPackage } from "@/server/services/patient-package.service";
import { validateUpdatePatientPackageInput } from "@/server/validators/patient-package.validator";
import { createRouteHandler } from "@/lib/api/route-handler";

export const GET = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const result = await getPatientPackageDetails(supabase, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});

export const PATCH = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const body = await request.json();
  const validatedInput = validateUpdatePatientPackageInput(body);
  const result = await updatePatientPackage(supabase, user.id, params.id, validatedInput);
  return NextResponse.json(result, { status: 200 });
});

export const DELETE = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const result = await deletePatientPackage(supabase, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});
