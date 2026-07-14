import { NextResponse, type NextRequest } from "next/server";
import { patientListQuerySchema, validateCreatePatientInput } from "@/server/validators/patient.validator";
import { createPatient, listOrganizationPatients } from "@/server/services/patient.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const POST = createRouteHandler(async (request, { supabase, user }) => {
  const body = await request.json();
  const validatedInput = validateCreatePatientInput(body);
  const result = await createPatient(supabase, user.id, validatedInput);
  return NextResponse.json(result, { status: 201 });
});

export const GET = createRouteHandler(async (request: NextRequest, { supabase, user }) => {
  const { searchParams } = new URL(request.url);
  const rawPage = searchParams.get("page");
  const rawLimit = searchParams.get("limit");
  const rawSearch = searchParams.get("search");
  const rawGender = searchParams.get("gender");

  const filters = patientListQuerySchema.parse({
    page: rawPage === null || rawPage === "" ? undefined : rawPage,
    limit: rawLimit === null || rawLimit === "" ? undefined : rawLimit,
    search: rawSearch === null ? undefined : rawSearch,
    gender: rawGender === null ? undefined : rawGender,
  });

  const result = await listOrganizationPatients(supabase, user.id, filters);
  return NextResponse.json(result, { status: 200 });
});
