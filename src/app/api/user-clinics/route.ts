import { NextResponse, type NextRequest } from "next/server";
import { validateAssignUserClinicInput } from "@/server/validators/user-clinic.validator";
import { assignUserToClinic, removeUserFromClinic } from "@/server/services/organization.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const POST = createRouteHandler(async (request, { supabase, user }) => {
  const body = await request.json();
  const validatedInput = validateAssignUserClinicInput(body);
  const result = await assignUserToClinic(supabase, user.id, validatedInput.userId, validatedInput.clinicId);
  return NextResponse.json(result, { status: 201 });
});

export const DELETE = createRouteHandler(async (request: NextRequest, { supabase, user }) => {
  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get("userId");
  const clinicId = searchParams.get("clinicId");

  if (!targetUserId || !clinicId) {
    return NextResponse.json({ error: "Missing userId or clinicId parameter" }, { status: 400 });
  }

  const result = await removeUserFromClinic(supabase, user.id, targetUserId, clinicId);
  return NextResponse.json(result, { status: 200 });
});
