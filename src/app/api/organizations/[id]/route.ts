import { NextResponse } from "next/server";
import { getOrganizationDetail, updateOrganizationProfile } from "@/server/services/organization.service";
import { validateUpdateOrganizationProfileInput } from "@/server/validators/organization.validator";
import { createRouteHandler } from "@/lib/api/route-handler";

export const GET = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const result = await getOrganizationDetail(supabase, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});

export const PATCH = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const body = await request.json();
  const validatedInput = validateUpdateOrganizationProfileInput(body);
  const result = await updateOrganizationProfile(supabase, user.id, params.id, validatedInput);
  return NextResponse.json(result, { status: 200 });
});
