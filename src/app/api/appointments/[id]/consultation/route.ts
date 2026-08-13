import { NextResponse } from "next/server";
import { createConsultationSchema } from "@/server/validators/consultation.validator";
import { createConsultation, getConsultationForAppointment } from "@/server/services/consultation.service";
import { createRouteHandler } from "@/lib/api/route-handler";

/**
 * Reads the appointment's consultation, or `null` when the visit has not been
 * recorded yet (F6, D5). A 200 with a null body, deliberately not a 404 --
 * "not started yet" is the normal state on the consultation destination, and
 * a 404 would route the client into the not-found frame.
 */
export const GET = createRouteHandler<{ id: string }>(async (_request, { supabase, user, params }) => {
  const result = await getConsultationForAppointment(supabase, user.id, params.id);
  return NextResponse.json(result);
});

export const POST = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const body = await request.json();
  const validatedInput = createConsultationSchema.parse({ ...body, appointmentId: params.id });
  const result = await createConsultation(supabase, user.id, validatedInput);
  return NextResponse.json(result, { status: 201 });
});
