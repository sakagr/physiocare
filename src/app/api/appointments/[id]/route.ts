import { NextResponse } from "next/server";
import { validateUpdateAppointmentInput } from "@/server/validators/appointment.validator";
import { getAppointmentDetails, updateAppointment, deleteAppointment } from "@/server/services/appointment.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const GET = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const result = await getAppointmentDetails(supabase, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});

export const PATCH = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const body = await request.json();
  const validatedInput = validateUpdateAppointmentInput(body);
  const result = await updateAppointment(supabase, user.id, params.id, validatedInput);
  return NextResponse.json(result, { status: 200 });
});

export const DELETE = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const result = await deleteAppointment(supabase, user.id, params.id);
  return NextResponse.json(result, { status: 200 });
});
