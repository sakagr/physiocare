import { NextResponse } from "next/server";
import { createConsultationSchema } from "@/server/validators/consultation.validator";
import { createConsultation } from "@/server/services/consultation.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const POST = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const body = await request.json();
  const validatedInput = createConsultationSchema.parse({ ...body, appointmentId: params.id });
  const result = await createConsultation(supabase, user.id, validatedInput);
  return NextResponse.json(result, { status: 201 });
});
