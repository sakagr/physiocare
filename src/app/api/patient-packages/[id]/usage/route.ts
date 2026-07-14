import { NextResponse, type NextRequest } from "next/server";
import { paginationSchema } from "@/server/validators/shared.validator";
import { listPatientPackageUsage } from "@/server/services/patient-package.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const GET = createRouteHandler<{ id: string }>(async (request: NextRequest, { supabase, user, params }) => {
  const { searchParams } = new URL(request.url);
  const rawPage = searchParams.get("page");
  const rawLimit = searchParams.get("limit");

  const filters = paginationSchema.parse({
    page: rawPage === null || rawPage === "" ? undefined : rawPage,
    limit: rawLimit === null || rawLimit === "" ? undefined : rawLimit,
  });

  const result = await listPatientPackageUsage(supabase, user.id, params.id, filters);
  return NextResponse.json(result, { status: 200 });
});
