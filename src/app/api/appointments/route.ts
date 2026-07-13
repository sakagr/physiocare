import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AppError, ErrorCodes } from "@/server/errors";
import { appointmentListQuerySchema, validateCreateAppointmentInput } from "@/server/validators/appointment.validator";
import { createAppointment, listOrganizationAppointments } from "@/server/services/appointment.service";

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const validatedInput = validateCreateAppointmentInput(body);
    const result = await createAppointment(supabase, user.id, validatedInput);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request payload", details: error.issues }, { status: 400 });
    }
    if (error instanceof AppError) {
      if (error.code === ErrorCodes.FORBIDDEN) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: 403 });
      }
      if (error.code === ErrorCodes.NOT_FOUND) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: 404 });
      }
    }
    console.error("Error creating appointment:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid query parameters", details: error.issues }, { status: 400 });
    }
    if (error instanceof AppError) {
      if (error.code === ErrorCodes.FORBIDDEN) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: 403 });
      }
    }
    console.error("Error listing appointments:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
