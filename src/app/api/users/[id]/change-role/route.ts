import { NextResponse } from "next/server";
import { changeUserRole } from "@/server/services/organization.service";
import { validateChangeUserRoleInput } from "@/server/validators/user.validator";
import { createRouteHandler } from "@/lib/api/route-handler";

export const POST = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const body = await request.json();
  const validatedInput = validateChangeUserRoleInput(body);
  const result = await changeUserRole(supabase, user.id, params.id, validatedInput.role);
  return NextResponse.json(result, { status: 200 });
});
