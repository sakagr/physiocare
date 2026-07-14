import { NextResponse } from "next/server";
import { getPackageDetails, updatePackage, deletePackage } from "@/server/services/package.service";
import { validateUpdatePackageInput } from "@/server/validators/package.validator";
import { createRouteHandler } from "@/lib/api/route-handler";

export const GET = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const result = await getPackageDetails(supabase, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});

export const PATCH = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const body = await request.json();
  const validatedInput = validateUpdatePackageInput(body);
  const result = await updatePackage(supabase, user.id, params.id, validatedInput);
  return NextResponse.json(result, { status: 200 });
});

export const DELETE = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const result = await deletePackage(supabase, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});
