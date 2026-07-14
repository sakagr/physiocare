import { NextResponse, type NextRequest } from "next/server";
import { appointmentListQuerySchema, validateCreateAppointmentInput } from "@/server/validators/appointment.validator";
import { createAppointment, listOrganizationAppointments } from "@/server/services/appointment.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const POST = createRouteHandler(async (request, { supabase, user }) => {
  const body = await request.json();
  const validatedInput = validateCreateAppointmentInput(body);
  const result = await createAppointment(supabase, user.id, validatedInput);
  return NextResponse.json(result, { status: 201 });
});

export const GET = createRouteHandler(async (request: NextRequest, { supabase, user }) => {
  const { searchParams } = new URL(request.url);
  const rawPage = searchParams.get("page");
  const rawLimit = searchParams.get("limit");
  const rawPatientId = searchParams.get("patientId");
  const rawClinicId = searchParams.get("clinicId");
  const rawPhysiotherapistId = searchParams.get("physiotherapistId");
  const rawStatus = searchParams.get("status");
  const rawDateFrom = searchParams.get("dateFrom");
  const rawDateTo = searchParams.get("dateTo");

  const filters = appointmentListQuerySchema.parse({
    page: rawPage === null || rawPage === "" ? undefined : rawPage,
    limit: rawLimit === null || rawLimit === "" ? undefined : rawLimit,
    patientId: rawPatientId === null ? undefined : rawPatientId,
    clinicId: rawClinicId === null ? undefined : rawClinicId,
    physiotherapistId: rawPhysiotherapistId === null ? undefined : rawPhysiotherapistId,
    status: rawStatus === null ? undefined : rawStatus,
    dateFrom: rawDateFrom === null || rawDateFrom === "" ? undefined : rawDateFrom,
    dateTo: rawDateTo === null || rawDateTo === "" ? undefined : rawDateTo,
  });

  const result = await listOrganizationAppointments(supabase, user.id, filters);
  return NextResponse.json(result, { status: 200 });
});
