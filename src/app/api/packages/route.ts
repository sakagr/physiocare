import { NextResponse, type NextRequest } from "next/server";
import { sharedListQuerySchema } from "@/server/validators/shared.validator";
import { validateCreatePackageInput } from "@/server/validators/package.validator";
import { createPackage, listOrganizationPackages } from "@/server/services/package.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const POST = createRouteHandler(async (request, { supabase, user }) => {
  const body = await request.json();
  const validatedInput = validateCreatePackageInput(body);
  const result = await createPackage(supabase, user.id, validatedInput);
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

  const result = await listOrganizationPackages(supabase, user.id, filters);
  return NextResponse.json(result, { status: 200 });
});
