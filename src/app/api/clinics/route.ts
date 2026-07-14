import { NextResponse, type NextRequest } from "next/server";
import { sharedListQuerySchema } from "@/server/validators/shared.validator";
import { validateCreateClinicInput } from "@/server/validators/clinic.validator";
import { listOrganizationClinics } from "@/server/services/clinic.service";
import { createClinic } from "@/server/services/organization.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const POST = createRouteHandler(async (request, { supabase, user }) => {
  const body = await request.json();
  const validatedInput = validateCreateClinicInput(body);
  const result = await createClinic(supabase, user.id, validatedInput);
  return NextResponse.json(result, { status: 201 });
});

export const GET = createRouteHandler(async (request: NextRequest, { supabase, user }) => {
  const { searchParams } = new URL(request.url);
  const rawPage = searchParams.get("page");
  const rawLimit = searchParams.get("limit");
  const rawSearch = searchParams.get("search");
  const rawIsActive = searchParams.get("isActive");

  const filters = sharedListQuerySchema.parse({
    page: rawPage === null || rawPage === "" ? undefined : rawPage,
    limit: rawLimit === null || rawLimit === "" ? undefined : rawLimit,
    search: rawSearch === null ? undefined : rawSearch,
    isActive: rawIsActive === null ? undefined : rawIsActive,
  });

  const result = await listOrganizationClinics(supabase, user.id, filters);
  return NextResponse.json(result, { status: 200 });
});
