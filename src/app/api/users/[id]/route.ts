import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserDetails } from "@/server/services/user.service";
import { updateUserProfile, offboardUser } from "@/server/services/organization.service";
import { validateUpdateUserProfileInput } from "@/server/validators/user.validator";
import { createRouteHandler } from "@/lib/api/route-handler";

export const GET = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const result = await getUserDetails(supabase, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});

export const PATCH = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const body = await request.json();
  const validatedInput = validateUpdateUserProfileInput(body);
  const result = await updateUserProfile(supabase, user.id, params.id, validatedInput);
  return NextResponse.json(result, { status: 200 });
});

export const DELETE = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const adminClient = createAdminClient();
  const result = await offboardUser(supabase, adminClient, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});
