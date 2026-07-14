import { NextResponse, type NextRequest } from "next/server";
import { createPrescriptionSchema } from "@/server/validators/prescription.validator";
import { paginationSchema } from "@/server/validators/shared.validator";
import { createPrescription, listOrganizationPrescriptions } from "@/server/services/prescription.service";
import { createRouteHandler } from "@/lib/api/route-handler";

export const POST = createRouteHandler<{ id: string }>(async (request, { supabase, user, params }) => {
  const body = await request.json();
  const validatedInput = createPrescriptionSchema.parse({ ...body, consultationId: params.id });
  const result = await createPrescription(supabase, user.id, validatedInput);
  return NextResponse.json(result, { status: 201 });
});

export const GET = createRouteHandler<{ id: string }>(async (request: NextRequest, { supabase, user, params }) => {
  const { searchParams } = new URL(request.url);
  const rawPage = searchParams.get("page");
  const rawLimit = searchParams.get("limit");

  const { page, limit } = paginationSchema.parse({
    page: rawPage === null || rawPage === "" ? undefined : rawPage,
    limit: rawLimit === null || rawLimit === "" ? undefined : rawLimit,
  });

  const result = await listOrganizationPrescriptions(supabase, user.id, { page, limit, consultationId: params.id });
  return NextResponse.json(result, { status: 200 });
});
