import { NextResponse } from "next/server";
import { validateUpdateAppointmentStatusInput } from "@/server/validators/appointment.validator";
import { updateAppointmentStatus } from "@/server/services/appointment.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const PATCH = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const body = await request.json();
  const validatedInput = validateUpdateAppointmentStatusInput(body);
  const result = await updateAppointmentStatus(supabase, user.id, params.id, validatedInput);
  return NextResponse.json(result, { status: 200 });
});
