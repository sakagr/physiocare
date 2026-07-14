import { NextResponse, type NextRequest } from "next/server";
import { createPatientPackageSchema, patientPackageListQuerySchema } from "@/server/validators/patient-package.validator";
import { createPatientPackage, listPatientPackagesForPatient } from "@/server/services/patient-package.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const POST = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const body = await request.json();
  const validatedInput = createPatientPackageSchema.parse({ ...body, patientId: params.id });
  const result = await createPatientPackage(supabase, user.id, validatedInput);
  return NextResponse.json(result, { status: 201 });
});

export const GET = createRouteHandler<{ id: string }>(async (request: NextRequest, { supabase, user, params }) => {
  const { searchParams } = new URL(request.url);
  const rawPage = searchParams.get("page");
  const rawLimit = searchParams.get("limit");
  const rawStatus = searchParams.get("status");

  const filters = patientPackageListQuerySchema.omit({ patientId: true }).parse({
    page: rawPage === null || rawPage === "" ? undefined : rawPage,
    limit: rawLimit === null || rawLimit === "" ? undefined : rawLimit,
    status: rawStatus === null ? undefined : rawStatus,
  });

  const result = await listPatientPackagesForPatient(supabase, user.id, params.id, filters);
  return NextResponse.json(result, { status: 200 });
});
